/* eslint-disable @typescript-eslint/require-await */

import type * as glassEasel from 'glass-easel'
import type {
  AgentEventKind,
  AgentRequestKind,
  AgentRecvMessage,
  AgentSendMessage,
  NodeId,
  dom,
} from './protocol/index'

export * as protocol from './protocol/index'

export interface MessageChannel {
  send(data: AgentSendMessage): void
  recv(listener: (data: AgentRecvMessage) => void): void
}

export type NodeMeta = {
  node: glassEasel.Node
  nodeId: NodeId
  sendChanges: boolean
}

export class Connection {
  readonly hostContext: glassEasel.GeneralBackendContext
  readonly hostElement: glassEasel.GeneralBackendElement
  readonly hostComponent?: glassEasel.GeneralComponent // TODO
  private messageChannel: MessageChannel
  private requestHandlers = Object.create(null) as Record<string, (detail: any) => Promise<any>>
  readonly documentNodeId = 1
  private nodeIdInc = 2
  private nodeIdMap = new WeakMap<glassEasel.Node, NodeId>()
  private activeNodes = Object.create(null) as Record<NodeId, NodeMeta>
  readonly mountPoints = [] as NodeId[]

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

  sendEvent<T extends keyof AgentEventKind>(name: T, detail: AgentEventKind[T]['detail']) {
    const data: AgentSendMessage = { kind: 'event', name, detail }
    this.messageChannel.send(data)
  }

  private generateNodeId(): NodeId {
    const ret = this.nodeIdInc
    this.nodeIdInc += 1
    return ret
  }

  private getNodeId(node: glassEasel.Node): NodeId {
    const nodeId = this.nodeIdMap.get(node)
    if (nodeId !== undefined) {
      return nodeId
    }
    const newNodeId = this.generateNodeId()
    this.nodeIdMap.set(node, newNodeId)
    return newNodeId
  }

  // eslint-disable-next-line class-methods-use-this
  private startWatch(node: glassEasel.Node) {
    // TODO
  }

  // eslint-disable-next-line class-methods-use-this
  private endWatch(node: glassEasel.Node) {
    // TODO
  }

  /**
   * Start tracking a node.
   *
   * This will also activate its parent or host (for shadow-root).
   */
  activateNode(node: glassEasel.Node, isMountPoint: boolean): NodeId {
    const nodeId = this.getNodeId(node)
    if (this.activeNodes[nodeId]) {
      return nodeId
    }
    if (isMountPoint) {
      this.mountPoints.push(nodeId)
    } else {
      const p =
        node.ownerShadowRoot === node
          ? (node as glassEasel.ShadowRoot).getHostNode()
          : node.parentNode
      if (p) this.activateNode(p, false)
    }
    this.activeNodes[nodeId] = { node, nodeId, sendChanges: false }
    this.startWatch(node)
    return nodeId
  }

  enableSendChanges(nodeId: NodeId, enabled: boolean) {
    if (this.activeNodes[nodeId]) {
      this.activeNodes[nodeId].sendChanges = enabled
    }
  }

  resolveNodeId(nodeId: NodeId): glassEasel.Node | undefined {
    return this.activeNodes[nodeId]?.node
  }

  /** Release a node tree (to allow gabbage collection). */
  deactivateNodeTree(node: glassEasel.Node): NodeId | undefined {
    const nodeId = this.nodeIdMap.get(node)
    if (nodeId === undefined) {
      return undefined
    }
    if (!this.activeNodes[nodeId]) {
      return nodeId
    }
    delete this.activeNodes[nodeId]
    this.endWatch(node)
    const shadowRoot = (node as glassEasel.GeneralComponent).getShadowRoot?.()
    if (shadowRoot) this.deactivateNodeTree(shadowRoot)
    const childNodes: glassEasel.Node[] | undefined = (node as glassEasel.Element).childNodes
    if (childNodes) {
      childNodes.forEach((node) => this.deactivateNodeTree(node))
    }
    return nodeId
  }

  collectNodeDetails(nodeId: NodeId): dom.Node | undefined {
    const meta = this.activeNodes[nodeId]
    if (!meta) return undefined
    const { node } = meta
    return {
      backendNodeId: nodeId,
      nodeType,
      nodeName,
      nodeId,
      parentId,
      localName,
      nodeValue,
      attributes,
      children,
      distributedNodes,
    }
  }
}

class InspectorDevToolsImpl {
  private conn: Connection

  constructor(conn: Connection) {
    this.conn = conn
  }

  // eslint-disable-next-line class-methods-use-this
  addMountPoint(root: glassEasel.GeneralComponent): void {
    if (root === this.conn.hostComponent) return
    const previousNodeId = this.conn.mountPoints[this.conn.mountPoints.length - 1] ?? 0
    const nodeId = this.conn.activateNode(root, true)
    this.conn.sendEvent('childNodeInserted', {
      parentNodeId: this.conn.documentNodeId,
      previousNodeId,
      node: this.conn.collectNodeDetails(nodeId)!,
    })
    this.conn.sendEvent('childNodeCountUpdated', {
      nodeId: this.conn.documentNodeId,
      childNodeCount: this.conn.mountPoints.length,
    })
  }

  // eslint-disable-next-line class-methods-use-this
  removeMountPoint(root: glassEasel.GeneralComponent): void {
    const nodeId = this.conn.deactivateNodeTree(root)
    if (!nodeId) return
    this.conn.sendEvent('childNodeRemoved', {
      parentNodeId: this.conn.documentNodeId,
      nodeId,
    })
    this.conn.sendEvent('childNodeCountUpdated', {
      nodeId: this.conn.documentNodeId,
      childNodeCount: this.conn.mountPoints.length,
    })
  }
}

export const getDevTools = (
  hostContext: glassEasel.GeneralBackendContext,
  hostElement: glassEasel.GeneralBackendElement,
  channel: MessageChannel,
) => {
  const connection = new Connection(hostContext, hostElement, channel)
  return {
    inspector: new InspectorDevToolsImpl(connection),
  }
}
