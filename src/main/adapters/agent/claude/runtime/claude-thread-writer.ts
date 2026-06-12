// ThreadWriter adapter backed by the Claude Agent SDK. The only write place that touches the SDK's
// session store. `renameThread` stores a custom title via renameSession; `deleteThread` removes the
// session via deleteSession. Both pass the workspace `cwd` as the SDK's `dir` so writes hit the same
// directory the reader lists, and convert any SDK failure to a ThreadWriteFailed.

import { deleteSession, renameSession } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { RenameThreadInput } from '../../../../application/agent/data/rename-thread-input'
import { ThreadWriteFailed } from '../../../../application/agent/error/thread-write-failed'
import { ThreadWriter } from '../../../../application/agent/port/thread-writer.port'

const renameThread = (input: RenameThreadInput): Effect.Effect<void, ThreadWriteFailed> =>
  Effect.tryPromise({
    try: () => renameSession(input.id, input.title, { dir: input.cwd }),
    catch: () => new ThreadWriteFailed({ cwd: input.cwd })
  })

const deleteThread = (cwd: string, id: string): Effect.Effect<void, ThreadWriteFailed> =>
  Effect.tryPromise({
    try: () => deleteSession(id, { dir: cwd }),
    catch: () => new ThreadWriteFailed({ cwd })
  })

export const ClaudeThreadWriterLive = Layer.succeed(
  ThreadWriter,
  ThreadWriter.of({ renameThread, deleteThread })
)
