import type * as glassEasel from 'glass-easel'
import { type Connection } from '.'
import { glassEaselVarToString, toGlassEaselVar, type NodeId, type dom } from './protocol'
import { GlassEaselNodeType, glassEaselNodeTypeToCDP } from './protocol/dom'

export type NodeMeta = {
  node: glassEasel.Node
  nodeId: NodeId
  sendChanges: boolean
}

export const enum StaticNodeName {
  Document = '#document',
  TextNode = '#text',
  ShadowRoot = '#shadow-root',
  Slot = 'SLOT',
  Unknown = 'UNKNOWN',
}

const getNodeType = (node: glassEasel.Node): GlassEaselNodeType => {
  if (node.asTextNode()) return GlassEaselNodeType.TextNode
  if (node.asNativeNode()) return GlassEaselNodeType.NativeNode
  if (node.asVirtualNode()) {
    if (node.ownerShadowRoot === node) {
      return GlassEaselNodeType.ShadowRoot
    }
    return GlassEaselNodeType.VirtualNode
  }
  if (node.asGeneralComponent()) return GlassEaselNodeType.Component
  return GlassEaselNodeType.Unknown
}

const getNodeName = (
  node: glassEasel.Node,
  nodeType: GlassEaselNodeType,
  local: boolean,
): string => {
  if (nodeType === GlassEaselNodeType.TextNode) return StaticNodeName.TextNode
  if (nodeType === GlassEaselNodeType.NativeNode) return node.asNativeNode()!.is
  if (nodeType === GlassEaselNodeType.Component) {
    const comp = node.asGeneralComponent()!
    return local ? comp.is : comp.tagName
  }
  if (nodeType === GlassEaselNodeType.VirtualNode) return node.asVirtualNode()!.is
  if (nodeType === GlassEaselNodeType.ShadowRoot) return StaticNodeName.ShadowRoot
  return StaticNodeName.Unknown
}

export class MountPoint {
  private conn: Connection
  private root: glassEasel.Element
  private env: glassEasel.MountPointEnv
  private nodeIdMap = new WeakMap<glassEasel.Node, NodeId>()
  private activeNodes = Object.create(null) as Record<NodeId, NodeMeta>

  constructor(conn: Connection, root: glassEasel.Element, env: glassEasel.MountPointEnv) {
    this.conn = conn
    this.root = root
    this.env = env
  }

  hasRoot(root: glassEasel.Element): boolean {
    return root === this.root
  }

  attach() {
    const nodeId = this.activateNode(this.root, true, true)
    const previousNode = this.conn.mountPoints[this.conn.mountPoints.length - 1]
    const previousNodeId = previousNode ? this.getNodeId(previousNode.root) : undefined
    this.conn.mountPoints.push(this)
    this.conn.sendEvent('DOM.childNodeInserted', {
      parentNodeId: this.conn.documentNodeId,
      previousNodeId: previousNodeId ?? 0,
      node: this.collectNodeDetails(nodeId, 0)!,
    })
    this.conn.sendEvent('DOM.childNodeCountUpdated', {
      nodeId: this.conn.documentNodeId,
      childNodeCount: this.conn.mountPoints.length,
    })
  }

  detach() {
    const nodeId = this.deactivateNodeTree(this.root)
    if (!nodeId) return
    this.conn.mountPoints = this.conn.mountPoints.filter((mp) => mp !== this)
    this.conn.sendEvent('DOM.childNodeRemoved', {
      parentNodeId: this.conn.documentNodeId,
      nodeId,
    })
    this.conn.sendEvent('DOM.childNodeCountUpdated', {
      nodeId: this.conn.documentNodeId,
      childNodeCount: this.conn.mountPoints.length,
    })
  }

  private getNodeId(node: glassEasel.Node): NodeId {
    const nodeId = this.nodeIdMap.get(node)
    if (nodeId !== undefined) {
      return nodeId
    }
    const newNodeId = this.conn.generateNodeId()
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
  private activateNode(node: glassEasel.Node, isMountPoint: boolean, sendChanges: boolean): NodeId {
    const nodeId = this.getNodeId(node)
    if (this.activeNodes[nodeId]) {
      if (!this.activeNodes[nodeId].sendChanges && sendChanges) {
        this.activeNodes[nodeId].sendChanges = true
      }
      return nodeId
    }
    if (!isMountPoint) {
      const p =
        node.ownerShadowRoot === node
          ? (node as glassEasel.ShadowRoot).getHostNode()
          : node.parentNode
      if (p) this.activateNode(p, false, true)
    }
    this.activeNodes[nodeId] = { node, nodeId, sendChanges }
    this.startWatch(node)
    return nodeId
  }

  private enableSendChanges(nodeId: NodeId, enabled: boolean) {
    if (this.activeNodes[nodeId]) {
      this.activeNodes[nodeId].sendChanges = enabled
    }
  }

  private resolveNodeId(nodeId: NodeId): glassEasel.Node | undefined {
    return this.activeNodes[nodeId]?.node
  }

  /** Release a node tree (to allow gabbage collection). */
  private deactivateNodeTree(node: glassEasel.Node): NodeId | undefined {
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

  private collectNodeBasicInfomation(nodeId: NodeId): dom.BackendNode | undefined {
    const meta = this.activeNodes[nodeId]
    if (!meta) return undefined
    const { node } = meta
    const ty = getNodeType(node)
    const nodeName = getNodeName(node, ty, false)
    const virtual = node.asElement()?.isVirtual() ?? false
    const inheritSlots = node.asElement()?.isInheritSlots() ?? false
    return {
      backendNodeId: nodeId,
      nodeType: glassEaselNodeTypeToCDP(ty),
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
    }
  }

  getRootDetails(depth: number): dom.Node {
    const nodeId = this.getNodeId(this.root)
    return this.collectNodeDetails(nodeId, depth)!
  }

  collectNodeDetails(nodeId: NodeId, depth: number): dom.Node | undefined {
    const meta = this.activeNodes[nodeId]
    if (!meta) return undefined
    const { node } = meta

    // collect node information
    const {
      backendNodeId,
      nodeType,
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
    } = this.collectNodeBasicInfomation(nodeId)!
    let parentId: NodeId | undefined
    if (node === this.root) parentId = this.conn.documentNodeId
    else if (node.parentNode) this.getNodeId(node.parentNode)
    else parentId = undefined
    const localName = getNodeName(node, ty, true)
    const nodeValue = node.asTextNode()?.textContent ?? ''

    // collect attributes
    const attributes: string[] = []
    let slotName: string | undefined
    if (ty !== GlassEaselNodeType.TextNode) {
      const elem = node.asElement()!
      if (elem.slot) attributes.push(':slot', elem.slot)
      if (elem.id) attributes.push(':id', elem.id)
      if (elem.class) attributes.push(':class', elem.class)
      if (elem.style) attributes.push(':style', elem.style)
      const maybeSlotName = Reflect.get(elem, '_$slotName') as unknown
      if (typeof maybeSlotName === 'string') {
        slotName = maybeSlotName
        attributes.push(':name', slotName)
      }
      elem.attributes.forEach(({ name, value }) => {
        attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
      })
    }

    // collect children
    let children: dom.Node[] | undefined
    if (depth > 0 && ty !== GlassEaselNodeType.TextNode) {
      const elem = node.asElement()!
      children = []
      elem.childNodes.forEach((child) => {
        const nodeId = this.activateNode(child, false, true)
        const n = this.collectNodeDetails(nodeId, depth - 1)
        if (n) children!.push(n)
      })
    }

    // collect children
    let distributedNodes: dom.BackendNode[] | undefined
    if (typeof slotName === 'string') {
      const elem = node.asElement()!
      distributedNodes = []
      elem.forEachComposedChild((child) => {
        const nodeId = this.activateNode(child, false, false)
        const n = this.collectNodeBasicInfomation(nodeId)
        if (n) distributedNodes!.push(n)
      })
    }

    return {
      backendNodeId,
      nodeType,
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
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
