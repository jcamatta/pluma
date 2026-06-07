// The atom of the IPC event contract. Event channels are one-way pushes from main to the renderer
// (no reply), so each definition carries only its channel string and the payload that is sent.

export interface IpcEventContractDefinition<Channel extends string = string, Payload = never> {
  readonly channel: Channel
  readonly payload: Payload
}
