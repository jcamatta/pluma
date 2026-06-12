// The cross-cutting observability layer shared by every IPC handler. It carries only logging: structured
// JSON output (one JSON object per log line) at Info level and above. Adapter layers stay per-handler;
// this layer holds nothing feature-specific, so it can back the whole main process.

import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'

const observabilityLayer = Layer.merge(Logger.json, Logger.minimumLogLevel(LogLevel.Info))

export { observabilityLayer }
