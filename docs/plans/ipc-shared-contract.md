# Shared IPC contract layout

Status: proposal
Scope: how `src/main` (backend) and `src/renderer` (frontend, via `src/preload`) agree on
what crosses IPC — the channels, the request payloads, the success values, and the errors.

## Why this exists

Electron IPC is an untyped string-keyed boundary. `ipcRenderer.invoke('file:write', x)` on one
side and `ipcMain.handle('file:write', …)` on the other are connected only by a string literal and
a convention. Nothing makes the two ends agree on the channel name, the payload shape, or the
result shape. If they drift, it compiles and fails at runtime.

Today that agreement is kept by hand in several places:

- Channel strings are written twice — in `src/main/ipc/register.ts` and again in
  `src/preload/index.ts`.
- Input payload types live under `src/main/application/**/data` and are reached into from preload.
- Error and `Result` shapes are re-declared a second time in `src/preload/preload-env.d.ts`.
- The renderer-facing surface (`interface Api`) is a hand-maintained list parallel to the preload
  implementation.

Adding one endpoint means editing four places, and none of them is checked against the others.

There is also an architectural problem. `eslint/architecture.mjs` forbids the renderer from
importing anything under `src/main/` — once through an `import-x/no-restricted-paths` zone and again
through a resolver-free `no-restricted-imports` regex backstop. Its message is explicit:

> The renderer must not import main-process code. Talk to main through the preload `window.api`
> bridge; declare the wire types on the renderer side.

The current preload reaches into `src/main/application/agent/data/run-agent-input`, which is exactly
the coupling that rule is meant to prevent. The dependency points the wrong way: preload/renderer
depend on main's internals, when the renderer is supposed to know nothing about main except the wire.

## The idea

Describe each channel **once**, in a place **both sides** are allowed to import, and **derive**
each side's view from that one description. Neither side declares the contract; both read it.

A "contract" is a type that carries four things about a channel:

```
channel  — the string literal key
input    — what the caller sends
value    — what comes back on success
error    — what comes back on failure
```

From the union of all contracts we derive, by channel:

- what the **renderer** must send and will receive (`IpcInput<C>`, `IpcResult<C>`), and
- what the **main** handler receives and must return (the same two types).

Because there is exactly one definition and TypeScript checks both ends against it, the two sides
cannot disagree. Change an input field and both ends fail to compile until they match.

The shared place is `src/shared` — the renderer may import it (it is not `src/main`), which is
precisely the "declare the wire types on the renderer side" path the eslint rule points at. The
contract depends on nothing app-specific; main, preload, and renderer all depend on it. This also
flips the dependency direction the right way round.

This is the pattern both reference projects in `.references/` (`serene` and `write-write`) converged
on independently. `write-write` matches Pluma's `src/{main,preload,renderer,shared}` layout, so the
placement here follows it.

## Layout

```
src/shared/ipc/
  ipc-result.ts            # Result<V, E> — the only thing that crosses the wire as an outcome
  ipc-contract/            # request/response channels (renderer -> main, awaits a reply)
    types.ts               #   IpcContractDefinition<Channel, Input, Value, Error>
    file.ts                #   FILE_*_CHANNEL constants + per-channel contract + error types
    folder.ts
    agent.ts
    index.ts               #   IpcContract union + IpcInput/IpcValue/IpcError/IpcResult<C>
  ipc-event-contract/      # push channels (main -> renderer, fire-and-forget)
    types.ts               #   IpcEventContractDefinition<Channel, Payload>
    folder.ts              #   folder:changed
    agent.ts               #   agent:event
    index.ts               #   IpcEventContract union + IpcEventPayload/IpcEventCallback<C>
  window-api.ts            # WindowApi = { invoke, on } — the single type the preload exposes
```

Two contract families because IPC has two directions:

- **`ipc-contract`** — request/response. The renderer calls and awaits a `Result`. (file/folder/agent
  commands.)
- **`ipc-event-contract`** — one-way push from main to renderer, no reply. (`folder:changed`,
  `agent:event`.) These have a `payload` but no `value`/`error`, because nothing is returned.

## The pieces

### 1. The contract atom

```ts
// src/shared/ipc/ipc-contract/types.ts
export type IpcContractDefinition<
  Channel extends string = string,
  Input = void,
  Value = never,
  Error = never
> = {
  readonly channel: Channel
  readonly input: Input
  readonly value: Value
  readonly error: Error
}
```

### 2. One channel, described once

The channel string and every shape it implies live together, in `shared`:

```ts
// src/shared/ipc/ipc-contract/file.ts
import type { IpcContractDefinition } from './types'

export const FILE_WRITE_CHANNEL = 'file:write'

export type FileWriteError = {
  readonly _tag: 'InvalidPath' | 'FileNotFound' | 'FileWriteFailed'
  readonly path: string
}

export type FileWriteContract = IpcContractDefinition<
  typeof FILE_WRITE_CHANNEL,
  { readonly path: string; readonly content: string }, // input
  string, // value (success)
  FileWriteError // error (failure)
>
```

The error keeps Pluma's existing `_tag` discriminated-union style — it is already wired through the
application layer. The contract is agnostic about the shape; it just holds whatever type sits in the
`error` slot. (The reference projects happen to use `{ code, message }`; we do not have to.)

### 3. The registry — derive both views from the union

```ts
// src/shared/ipc/ipc-contract/index.ts
export type IpcContract =
  | FileCreateContract
  | FileWriteContract
  | FileDeleteContract
  | FolderCreateContract
  // …every channel…
  | AgentRunContract
  | AgentAbortContract

export type IpcChannel = IpcContract['channel']

type ByChannel<C extends IpcChannel> = Extract<IpcContract, { readonly channel: C }>

export type IpcInput<C extends IpcChannel> = ByChannel<C>['input']
export type IpcValue<C extends IpcChannel> = ByChannel<C>['value']
export type IpcError<C extends IpcChannel> = ByChannel<C>['error']
export type IpcResult<C extends IpcChannel> = Result<IpcValue<C>, IpcError<C>>
```

`Extract<…, { channel: C }>` picks the one contract whose channel matches `C`, so `IpcInput<'file:write'>`
resolves to exactly that channel's input. Adding a channel to the union is the only edit needed for
the type machinery to know about it everywhere.

### 4. The single bridge type

The whole renderer-facing surface is two generic methods, not one bespoke method per endpoint:

```ts
// src/shared/ipc/window-api.ts
export type WindowApi = {
  readonly invoke: <C extends IpcChannel>(
    channel: C,
    ...args: IpcInput<C> extends void ? [] : [payload: IpcInput<C>]
  ) => Promise<IpcResult<C>>
  readonly on: <C extends IpcEventChannel>(channel: C, callback: IpcEventCallback<C>) => () => void
}
```

The conditional rest-arg (`extends void ? [] : [payload]`) means channels with no input are called as
`invoke(CHANNEL)` and channels with input as `invoke(CHANNEL, payload)`, both type-checked.

### 5. Preload — generic, ~15 lines

Preload stops mirroring every endpoint and just forwards, typed once by `WindowApi`:

```ts
// src/preload/index.ts (shape)
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)
const on = (channel, callback) => {
  /* subscribe, return unsubscribe */
}
contextBridge.exposeInMainWorld('api', { invoke, on } satisfies WindowApi)
```

`src/preload/preload-env.d.ts` shrinks to just `interface Window { api: WindowApi }`; the ~80 lines
of hand-copied `Result`/error/`Api` types are deleted.

### 6. Main — register from the contract in one loop

Each domain exports a typed array of `{ endpoint, handle }`, and a single registrar wires them:

```ts
// src/main/ipc/register-handlers.ts (shape)
const handlers = [...fileIpcs, ...folderIpcs, ...agentIpcs]
for (const h of handlers) ipcMain.handle(h.endpoint, h.handle)
```

Each `handle` is typed `(event, input: IpcInput<C>) => Promise<IpcResult<C>>`, so a handler that
returns the wrong shape fails to compile against the same contract the renderer reads.

## How a call flows

```
renderer  window.api.invoke(FILE_WRITE_CHANNEL, { path, content })
            │  typed by IpcInput<'file:write'> / IpcResult<'file:write'>
preload   ipcRenderer.invoke(channel, payload)        ← generic passthrough
   ── IPC ──
main      ipcMain.handle('file:write', handle)        ← handle: input -> Promise<Result>
            │  runs the use case, serializes success/failure into Result
            └─ returns Result<string, FileWriteError>
   ── IPC ──
renderer  awaits Result<string, FileWriteError>       ← same type, guaranteed
```

For events the direction reverses: main `webContents.send(AGENT_EVENT_CHANNEL, payload)` and the
renderer `window.api.on(AGENT_EVENT_CHANNEL, cb)`, with `payload` typed by `IpcEventPayload<C>`.

## Boundaries this respects

- **Effect never crosses IPC.** Unchanged and reinforced. `Result<T, E>` is the only outcome type on
  the wire; it simply moves from `src/main/ipc/result.ts` into `src/shared/ipc/ipc-result.ts` so both
  sides cite one definition. Handlers still run the Effect use case and serialize to `Result` at the
  edge.
- **Renderer never imports `src/main`.** The contract lives in `src/shared`, which the renderer is
  allowed to import. This is the "declare the wire types on the renderer side" path that
  `eslint/architecture.mjs` describes — and it removes the current illegal `import('../main/…')` in
  preload.
- **Dependency direction.** `shared` depends on nothing app-specific; `main`, `preload`, and
  `renderer` depend on `shared`. (Today preload depends on main, which is backwards.)
- **Where the controllers/adapters use it.** The eslint rules already restrict `window.api` to
  renderer controllers (via hooks) and renderer adapters; views and plain components get data via
  props. The contract changes none of that — it only types what `window.api` carries.

## AG-UI and shared package types

Types from `@ag-ui/core` (`BaseEvent`, `Message`, `Tool`) are referenced directly by the contracts —
both processes already depend on that package, so there is nothing to copy. The `agent:event` event
payload is `BaseEvent`; `run-agent` input references `Message`/`Tool` from the package.

## Layer rule: only the ipc layer may import shared

`src/shared/ipc` is the API/wire layer. The **application** and **adapters** layers stay pure domain
and must **not** import `src/shared` — only the ipc handlers (and the preload bridge) may. The ipc
handler is the single place that maps between the application's own domain types and the wire contract.

This means the wire shapes are **declared independently in shared**, not shared with the application
layer:

- The application keeps its own `RunAgentInput` / `RunAgentState` / `Entry` / error types under
  `src/main/application/**`.
- `src/shared/ipc` declares the _wire_ counterparts (`RunAgentInput`, `FolderEntry`, the serialized
  error unions). For the agent input these are built purely from `@ag-ui/core` and are structurally
  identical to the application's, so the ipc handler hands the received wire input straight to the use
  case with no cast. For errors, the handler maps the application error's `_tag`/`path` into the wire
  error in its `onFailure` branch (as it already did with the old inline `SerializedError`).

This is enforced by `eslint/architecture.mjs`:

- a `no-restricted-paths` zone (`target: application + adapters`, `from: ./src/shared`) that states
  the intent, and
- a `no-restricted-imports` regex backstop (`domainNoSharedImports`) banning any `shared/` specifier
  from `src/main/application` and `src/main/adapters`. The backstop is the part that actually fires:
  the project configures no import resolver, so the path-zone rules are inert (the same is already
  true of the renderer→main zone, which is why that one also has a regex backstop).

## What changes, concretely

- **New:** `src/shared/ipc/**` — the contract, its two registries, `Result`, and `WindowApi`.
- **`src/preload/index.ts`** → generic `invoke`/`on` typed by `WindowApi`.
- **`src/preload/preload-env.d.ts`** → just `interface Window { api: WindowApi }`; delete the copied
  type block.
- **`src/main/ipc/register.ts`** → per-domain `*Ipcs` arrays + a `register-handlers.ts` loop;
  handlers typed by `IpcInput<C>` / `IpcResult<C>`.
- **`src/main/ipc/result.ts`** → moves to `src/shared/ipc/ipc-result.ts`.
- **Input/error types** → moved into `src/shared/ipc` (option A).
- **Renderer call sites** → `window.api.invoke(CHANNEL, payload)` with full inference.

## The wire boundary, cast-free

The reference preloads use a single cast — `ipcRenderer.invoke(...) as Promise<IpcResult<C>>` — to
bridge Electron's untyped return to the contract type. `AGENTS.md` bans `as` (except `as const`), so
pluma does it without one:

- `invoke` returns `Promise<IpcResult<Channel>>` by its declared return type. `ipcRenderer.invoke`
  resolves to `any`, which is assignable to that, so the annotation narrows it with no cast.
- `on`'s listener takes the payload as `unknown` (so it stays assignable to Electron's listener type)
  and `assertWire<IpcEventPayload<Channel>>(payload, channel)` narrows it before the callback.
  `assertWire` (in `src/shared/ipc/from-wire.ts`) uses an `asserts value is T` signature — the same
  no-`as`, no-`!` narrowing tool as `src/shared/invariant.ts` — and checks the one thing that always
  holds for our payloads: every event payload is a non-null object. This is the single trusted
  narrowing at the boundary; main produced the value from the same contract.
