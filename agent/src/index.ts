/* eslint-disable @typescript-eslint/require-await */

import type * as glassEasel from 'glass-easel'
import type {
  AgentEventKind,
  AgentRequestKind,
  AgentRecvMessage,
  AgentSendMessage,
} from './protocol/index'

export * as protocol from './protocol/index'

export interface MessageChannel {
  send(data: AgentSendMessage): void
  recv(listener: (data: AgentRecvMessage) => void): void
}

class InspectorDevToolsImpl {
  private hostContext: glassEasel.GeneralBackendContext
  private hostElement: glassEasel.GeneralBackendElement
  private hostComponent?: glassEasel.GeneralComponent // TODO
  private messageChannel: MessageChannel
  private requestHandlers = Object.create(null) as Record<string, (detail: any) => Promise<any>>
  private nodeIdInc = 1
  private nodeIdMap = new WeakMap<glassEasel.Node, number>()

  constructor(
    hostContext: glassEasel.GeneralBackendContext,
    hostElement: glassEasel.GeneralBackendElement,
    messageChannel: MessageChannel,
  ) {
    this.hostContext = hostContext
    this.hostElement = hostElement
    this.messageChannel = messageChannel
    messageChannel.recv((data) => {
      if (data.kind === 'request') {
        this.recvRequest(data.id, data.name, data.detail)
      }
    })
  }

  private generateNodeId() {
    const ret = this.nodeIdInc
    this.nodeIdInc += 1
    return ret
  }

  sendEvent<T extends keyof AgentEventKind>(name: T, detail: AgentEventKind[T]['detail']) {
    const data: AgentSendMessage = { kind: 'event', name, detail }
    this.messageChannel.send(data)
  }

  private recvRequest(id: number, name: string, detail: unknown) {
    const handler = this.requestHandlers[name]
    if (!handler) {
      const data: AgentSendMessage = {
        kind: 'error',
        id,
        message: 'invalid request name',
      }
      this.messageChannel.send(data)
      return
    }
    handler
      .call(this, detail)
      .then((ret: unknown) => {
        const data: AgentSendMessage = { kind: 'response', id, detail: ret }
        this.messageChannel.send(data)
        return undefined
      })
      .catch((err) => {
        const data: AgentSendMessage = {
          kind: 'error',
          id,
          message: err instanceof Error ? err.message : '',
          stack: err instanceof Error ? err.stack : '',
        }
        this.messageChannel.send(data)
      })
  }

  setRequestHandler<T extends keyof AgentRequestKind>(
    name: string,
    handler: (detail: AgentRequestKind[T]['request']) => Promise<AgentRequestKind[T]['response']>,
  ) {
    this.requestHandlers[name] = handler
  }

  // eslint-disable-next-line class-methods-use-this
  addMountPoint(root: glassEasel.GeneralComponent): void {
    if (root === this.hostComponent) return
    const nodeId = this.generateNodeId()
    this.nodeIdMap.set(root, nodeId)
    this.sendEvent('addMountPoint', { nodeId })
  }

  // eslint-disable-next-line class-methods-use-this
  removeMountPoint(root: glassEasel.GeneralComponent): void {
    const nodeId = this.nodeIdMap.get(root)
    if (!nodeId) return
    // FIXME remove all nodes from nodeIdMap?
    this.sendEvent('removeMountPoint', { nodeId })
  }
}

export const getDevTools = (
  hostContext: glassEasel.GeneralBackendContext,
  hostElement: glassEasel.GeneralBackendElement,
  channel: MessageChannel,
) => ({
  inspector: new InspectorDevToolsImpl(hostContext, hostElement, channel),
})
