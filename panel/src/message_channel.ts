import type { protocol } from 'glass-easel-devtools-agent'
import { error, warn, debug } from './utils'

export { protocol } from 'glass-easel-devtools-agent'

export type PanelRecvMessage = protocol.AgentSendMessage
export type PanelSendMessage = protocol.AgentRecvMessage

export interface MessageChannel {
  send(data: PanelSendMessage): void
  recv(listener: (data: PanelRecvMessage) => void): void
}

let messageChannel: MessageChannel | null = null
const eventHandlers = new Map<string, (data: any) => void>()
const requestCallbacks = new Map<number, (data: any) => void>()
let requestIdInc = 1

export const setMessageChannel = (mc: MessageChannel) => {
  messageChannel = mc
  messageChannel.recv((data) => {
    if (data.kind === 'event') {
      const handler = eventHandlers.get(data.name)
      if (!handler) {
        warn(`missing event handler for ${data.name}`)
      } else {
        debug(`recv event`, data.name, data.detail)
        handler(data.detail)
      }
    } else if (data.kind === 'response') {
      const requestId = data.id
      const callback = requestCallbacks.get(requestId)
      if (!callback) {
        warn(`illegal response for request ${requestId.toString()}`)
      } else {
        requestCallbacks.delete(requestId)
        debug(`recv response ${requestId.toString()}`, data.detail)
        callback(data.detail)
      }
    } else if (data.kind === 'error') {
      const requestId = data.id
      const callback = requestCallbacks.get(requestId)
      if (!callback) {
        warn(`illegal error response for request ${requestId.toString()}`)
      } else {
        error(
          `request error for request ${requestId.toString()}: ${data.message || '(unknown)'}`,
          data.stack,
        )
      }
    }
  })
}

export const setEventHandler = <T extends keyof protocol.AgentEventKind>(
  name: T,
  handler: (detail: protocol.AgentEventKind[T]['detail']) => void,
) => {
  eventHandlers.set(name, handler)
}

export const sendRequest = <T extends keyof protocol.AgentRequestKind>(
  name: T,
  detail: protocol.AgentRequestKind[T]['request'],
): Promise<protocol.AgentRequestKind[T]['response']> => {
  const requestId = requestIdInc
  requestIdInc += 1
  return new Promise((resolve): void => {
    requestCallbacks.set(requestId, resolve)
    debug(`send request ${requestId.toString()}`, name, detail)
    messageChannel?.send({ kind: 'request', id: requestId, name, detail })
  })
}
