import type * as glassEasel from 'glass-easel'
import { type Connection } from '.'
import { glassEaselVarToString, toGlassEaselVar, type NodeId, type dom } from './protocol'
import { GlassEaselNodeType, glassEaselNodeTypeToCDP } from './protocol/dom'
import { warn } from './utils'

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

export class MountPointsManager {
  private conn: Connection
  private nodeIdMap = new WeakMap<glassEasel.Node, NodeId>()
  private activeNodes = Object.create(null) as Record<NodeId, NodeMeta>
  readonly documentNodeId = 1
  private nodeIdInc = 2
  mountPoints: { nodeMeta: NodeMeta; env: glassEasel.MountPointEnv }[] = []

  constructor(conn: Connection) {
    this.conn = conn
    this.init()
  }

  init() {
    this.conn.setRequestHandler('DOM.getDocument', async ({ depth }) => {
      let children: dom.Node[] | undefined
      if (depth) {
        children = this.mountPoints.map(({ nodeMeta }) =>
          this.collectNodeDetails(nodeMeta, depth - 1, true),
        )
      }
      const ty = GlassEaselNodeType.Unknown
      const root: dom.Node = {
        backendNodeId: this.documentNodeId,
        nodeType: glassEaselNodeTypeToCDP(ty),
        glassEaselNodeType: ty,
        nodeName: StaticNodeName.Document,
        virtual: true,
        inheritSlots: false,
        nodeId: this.documentNodeId,
        localName: StaticNodeName.Document,
        nodeValue: '',
        attributes: [],
        children,
      }
      return { root }
    })

    this.conn.setRequestHandler('DOM.requestChildNodes', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const elem = node.asElement()
      if (!elem) return
      const nodes = elem.childNodes.map((child) => {
        const nodeMeta = this.activateNode(child, false, true)
        return this.collectNodeDetails(nodeMeta, 0, false)
      })
      this.conn.sendEvent('DOM.setChildNodes', { parentId: nodeId, nodes })
    })
  }

  attach(root: glassEasel.Element, env: glassEasel.MountPointEnv) {
    const nodeMeta = this.activateNode(root, true, true)
    const previousNode = this.mountPoints[this.mountPoints.length - 1]
    const previousNodeId = previousNode ? previousNode.nodeMeta.nodeId : undefined
    this.mountPoints.push({ nodeMeta, env })
    this.conn.sendEvent('DOM.childNodeInserted', {
      parentNodeId: this.documentNodeId,
      previousNodeId: previousNodeId ?? 0,
      node: this.collectNodeDetails(nodeMeta, 0, true),
    })
    this.conn.sendEvent('DOM.childNodeCountUpdated', {
      nodeId: this.documentNodeId,
      childNodeCount: this.mountPoints.length,
    })
  }

  detach(root: glassEasel.Element) {
    const index = this.mountPoints.findIndex((x) => x.nodeMeta.node === root)
    if (index < 0) {
      warn('no such mount point to remove')
      return
    }
    this.mountPoints.splice(index, 1)
    const nodeId = this.deactivateNodeTree(root)
    if (!nodeId) return
    this.conn.sendEvent('DOM.childNodeRemoved', {
      parentNodeId: this.documentNodeId,
      nodeId,
    })
    this.conn.sendEvent('DOM.childNodeCountUpdated', {
      nodeId: this.documentNodeId,
      childNodeCount: this.mountPoints.length,
    })
  }

  generateNodeId(): NodeId {
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

  private queryActiveNode(nodeId: NodeId): NodeMeta {
    const nodeMeta = this.activeNodes[nodeId]
    if (!nodeMeta) throw new Error(`no active node found for node id ${nodeId}`)
    return nodeMeta
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
  private activateNode(
    node: glassEasel.Node,
    isMountPoint: boolean,
    sendChanges: boolean,
  ): NodeMeta {
    const nodeId = this.getNodeId(node)
    if (this.activeNodes[nodeId]) {
      const nodeMeta = this.activeNodes[nodeId]
      if (!nodeMeta.sendChanges && sendChanges) {
        nodeMeta.sendChanges = true
      }
      return nodeMeta
    }
    if (!isMountPoint) {
      const p =
        node.ownerShadowRoot === node
          ? (node as glassEasel.ShadowRoot).getHostNode()
          : node.parentNode
      if (p) this.activateNode(p, false, true)
    }
    const nodeMeta = { node, nodeId, sendChanges }
    this.activeNodes[nodeId] = nodeMeta
    this.startWatch(node)
    return nodeMeta
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

  // eslint-disable-next-line class-methods-use-this
  private collectNodeBasicInfomation(nodeMeta: NodeMeta): dom.BackendNode {
    const { nodeId, node } = nodeMeta
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

  collectNodeDetails(nodeMeta: NodeMeta, depth: number, isMountPoint: boolean): dom.Node {
    const { nodeId, node } = nodeMeta

    // collect node information
    const {
      backendNodeId,
      nodeType,
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
    } = this.collectNodeBasicInfomation(nodeMeta)
    let parentId: NodeId | undefined
    if (isMountPoint) parentId = this.documentNodeId
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
      if (elem.asNativeNode()) {
        elem.attributes.forEach(({ name, value }) => {
          attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
        })
      } else {
        const comp = elem.asGeneralComponent()
        if (comp) {
          const definition = comp.getComponentDefinition()
          // TODO
        }
      }
    }

    // collect shadow-roots
    const sr = node.asGeneralComponent()?.getShadowRoot()
    const shadowRootType = sr ? 'open' : undefined
    let shadowRoots: dom.Node[] | undefined
    if (sr) {
      const nodeMeta = this.activateNode(sr, false, true)
      const n = this.collectNodeDetails(nodeMeta, depth - 1, false)
      if (n) shadowRoots = [n]
    }

    // collect children
    let children: dom.Node[] | undefined
    if (depth > 0 && ty !== GlassEaselNodeType.TextNode) {
      const elem = node.asElement()!
      children = []
      elem.childNodes.forEach((child) => {
        const nodeMeta = this.activateNode(child, false, true)
        const n = this.collectNodeDetails(nodeMeta, depth - 1, false)
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
      shadowRootType,
      shadowRoots,
      children,
      distributedNodes,
    }
  }
}
