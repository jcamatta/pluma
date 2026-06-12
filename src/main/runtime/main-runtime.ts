// The single ManagedRuntime every IPC handler runs on. It builds the observability layer once and
// provides its logging to all handler effects, so logging is ambient rather than threaded through each
// call. Disposed on app quit (see src/main/index.ts).

import * as ManagedRuntime from 'effect/ManagedRuntime'
import { observabilityLayer } from './observability-layer'

const mainRuntime = ManagedRuntime.make(observabilityLayer)

export { mainRuntime }
