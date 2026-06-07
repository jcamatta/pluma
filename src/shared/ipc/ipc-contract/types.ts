// The atom of the IPC wire contract. Each request/response channel is described once as an
// IpcContractDefinition carrying its channel string, the input the renderer sends, the value returned
// on success, and the tagged error returned on failure. Both the main ipc handlers and the preload
// bridge derive their views from these definitions, so the two ends cannot disagree.

export interface IpcContractDefinition<
  Channel extends string = string,
  Input = void,
  Value = never,
  Error extends { _tag: string } = never
> {
  readonly channel: Channel
  readonly input: Input
  readonly value: Value
  readonly error: Error
}
