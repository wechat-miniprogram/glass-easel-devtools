import type * as glassEasel from 'glass-easel'
import type {
  AgentEventKind,
  AgentRequestKind,
  AgentRecvMessage,
  AgentSendMessage,
} from './protocol/index'
import { MountPointsManager } from './mount_point'
import { debug } from './utils'

export * as protocol from './protocol/index'

export interface MessageChannel {
  send(data: AgentSendMessage): void
  recv(listener: (data: AgentRecvMessage) => void): void
}

export class Connection {
  readonly hostContext: glassEasel.GeneralBackendContext
  readonly hostElement: glassEasel.GeneralBackendElement
  readonly hostComponent?: glassEasel.GeneralComponent // TODO
  private messageChannel: MessageChannel
  private requestHandlers = Object.create(null) as Record<string, (detail: any) => Promise<any>>

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
        debug(`recv request ${data.id}`, data.name, data.detail)
        this.recvRequest(data.id, data.name, data.detail)
      }
    })
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
        debug(`send response ${id}`, ret)
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
    name: T,
    handler: (detail: AgentRequestKind[T]['request']) => Promise<AgentRequestKind[T]['response']>,
  ) {
    this.requestHandlers[name] = handler
  }

  sendEvent<T extends keyof AgentEventKind>(name: T, detail: AgentEventKind[T]['detail']) {
    debug('send event', name, detail)
    const data: AgentSendMessage = { kind: 'event', name, detail }
    this.messageChannel.send(data)
  }
}

class InspectorDevToolsImpl implements glassEasel.InspectorDevTools {
  private conn: Connection
  private mountPoints: MountPointsManager
  private enabled = false

  constructor(conn: Connection) {
    this.conn = conn
    this.mountPoints = new MountPointsManager(conn)
    conn.setRequestHandler('DOM.enable', async () => {
      if (this.enabled) return
      this.enabled = true
    })
  }

  // eslint-disable-next-line class-methods-use-this
  addMountPoint(root: glassEasel.Element, env: glassEasel.MountPointEnv): void {
    if (root === this.conn.hostComponent) return
    this.mountPoints.attach(root, env)
  }

  // eslint-disable-next-line class-methods-use-this
  removeMountPoint(root: glassEasel.GeneralComponent): void {
    this.mountPoints.detach(root)
  }
}

export const getDevTools = (
  hostContext: glassEasel.GeneralBackendContext,
  hostElement: glassEasel.GeneralBackendElement,
  channel: MessageChannel,
): glassEasel.DevTools => {
  const connection = new Connection(hostContext, hostElement, channel)
  return {
    inspector: new InspectorDevToolsImpl(connection),
  }
}
