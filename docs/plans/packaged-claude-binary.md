# Make the bundled Claude binary runnable in a packaged build

In a packaged build the agent cannot run at all: the run fails immediately, with no steps and a
generic "Run failed". The cause is packaging, not authentication. `@anthropic-ai/claude-agent-sdk` is
a production dependency, so electron-builder packs it — and its platform package
`@anthropic-ai/claude-agent-sdk-win32-x64`, whose only real content is `claude.exe` — into
`app.asar`. An asar is a virtual archive: a path inside it can be read, but not executed. The SDK
resolves its executable by module resolution (its default is `require.resolve` of the platform
package, never a PATH lookup), so it hands the spawn a path the OS cannot run.

The fix is to unpack the platform package and tell the SDK where the unpacked copy is. This affects
only packaged builds; `npm run dev` resolves to a real file on disk and is unaffected.

The fix must hold on **Windows, macOS and Linux**. The code is naturally OS-agnostic — `app.asar`
appears in the resolved path on every platform, and the redirect is a string transform with no
separator or platform assumption — but each OS has its own packaging caveat, so each is validated
separately rather than assumed from the Windows result.

## Done

- On **each of the three OSes**, installing the built artifact on a machine with a valid Claude
  sign-in and sending a message produces a real agent run — the model replies and tool calls work.
- Installing it with **no** sign-in produces the `authentication` failure header from #80, not a
  spawn failure — i.e. the packaged app fails for the honest reason.
- `npm run dev` behaviour is unchanged on all three.
- `npm run lint`, `npm run test`, `npm run type-coverage`, `npm run build` green.

## Steps

### 1. `[chore]` Unpack the SDK's platform package from the asar

- `electron-builder.yml` — add the SDK platform packages to `asarUnpack` alongside `resources/**`:
  `node_modules/@anthropic-ai/claude-agent-sdk-*/**`. One glob covers all seven platform packages
  (win32 x64/arm64, darwin x64/arm64, linux x64/arm64 and their musl variants), and npm installs only
  the host's optional dependency, so exactly one is ever present in a given build — no artifact
  carries another platform's binary.

No size regression: the binary (244 MB on win32-x64) is already shipped inside the asar today. This
moves it to `app.asar.unpacked`, it does not add it.

`asarUnpack` preserves the file mode, so the executable bit survives on macOS and Linux. Step 3
confirms that rather than trusting it.

Config only — weight 0, no test. Inert on its own: nothing reads the unpacked copy until step 2.

### 2. `[backend]` Point the SDK at the unpacked copy

- `src/main/adapters/agent/claude/logic/claude-executable-path.ts` (new) — a calculation:
  given the resolved module path of the platform package's executable, return the path the OS can
  spawn. If the path lies inside `app.asar`, redirect it to the sibling `app.asar.unpacked`;
  otherwise return it unchanged. String-only, so it needs no `electron` import and no `app.isPackaged`
  check — the presence of `app.asar` in the path *is* the packaged condition.
- `src/main/adapters/agent/claude/logic/__tests__/claude-executable-path.test.ts` (new) — the
  packaged path is redirected, a dev `node_modules` path is untouched.
- `src/main/adapters/agent/claude/logic/build-options.ts` — accept the executable path as an input and
  set `pathToClaudeCodeExecutable` from it. `build-options` is a calculation and must stay one, so it
  does not resolve anything itself.
- `src/main/adapters/agent/claude/runtime/claude-runtime-agent.ts` — resolve the platform package's
  `claude.exe`, run it through the calculation above, and pass the result into `buildOptions`.
  Resolution touches the filesystem, so it belongs in `runtime/`.

Well under the size budget and lands with its test.

### 3. `[validation]` Prove it in a real packaged install, on each OS

No e2e spec: the Playwright driver runs `out/main/index.js` directly, which never produces an asar, so
the defect is invisible to the suite by construction. This step is validation work, not code —
build the artifact, install it, and exercise the chat both signed in and signed out, capturing the
transcripts for the PR body.

Per OS, with its own caveat to watch for:

- **Windows** (`npm run build:win`) — the platform this was diagnosed on; `change-validator` can run
  it here.
- **macOS** (`npm run build:mac`) — check the executable bit survived, and that Gatekeeper does not
  block the spawn. An unsigned binary inside the app bundle is the risk here; `notarize: false`
  today, so an unsigned build must at minimum work locally.
- **Linux** (`npm run build:linux`) — AppImage is the straightforward target. Snap's confinement may
  refuse to spawn a bundled executable; if it does, that is a finding to record, not something this
  plan fixes.

Only Windows can be validated from this machine. macOS and Linux need a build on their own OS — see
the open question below.

### 4. `[docs]` Remove this plan

Its own `docs:` commit, per `finish-plan`.

## Constraints

- Hexagonal layering: the path logic is a calculation in `logic/`; only `runtime/` resolves the module
  and touches the SDK options.
- No new dependencies.
- No `as` casts, no lint or type escape hatches.
- No user-facing strings, so no locale work.

## Open questions

- **How do the macOS and Linux artifacts get built?** This is the real obstacle to "works on all
  three", and it is not a code problem. npm installs only the *host's* optional dependency, so a
  Windows machine can never produce a macOS artifact containing `claude` — the binary simply is not
  on disk to pack. Each artifact must be built on its own OS. There is no CI in this repo today
  (`.github/` does not exist); `build:win` / `build:mac` / `build:linux` are run by hand. A release
  workflow with a three-OS matrix is the natural answer, but it is its own change and should not be
  smuggled into this fix. **Decision needed:** does this plan stop at "the fix is correct and proven
  on Windows", with mac/linux proof following once there is a way to build them?
- **macOS signing.** An unsigned 244 MB binary sitting in `app.asar.unpacked` inside a signed `.app`
  is the usual cause of notarization and hardened-runtime failures. `notarize: false` today, so this
  does not bite yet — but it will at release, and it belongs to the release plan rather than here.
- **Installer size.** 244 MB of binary is already in today's artifact, so this changes nothing, but it
  is worth knowing before the open-source release announces a download size.
