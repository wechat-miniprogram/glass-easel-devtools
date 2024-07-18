import type * as glassEasel from 'glass-easel'
import { type Connection } from '.'
import {
  type GlassEaselVar,
  glassEaselVarToString,
  toGlassEaselVar,
  type NodeId,
  type dom,
} from './protocol'
import { GlassEaselNodeType, glassEaselNodeTypeToCDP } from './protocol/dom'
import { warn } from './utils'

export type NodeMeta = {
  node: glassEasel.Node
  nodeId: NodeId
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
  if (node.asVirtualNode()) return GlassEaselNodeType.VirtualNode
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
  return StaticNodeName.Unknown
}

export class MountPointsManager {
  private conn: Connection
  private nodeIdMap = new WeakMap<glassEasel.Node, NodeId>()
  private activeNodes = Object.create(null) as Record<NodeId, NodeMeta>
  private activeBackendNodes = Object.create(null) as Record<NodeId, WeakRef<glassEasel.Node>>
  readonly documentNodeId = 1
  private nodeIdInc = 2
  private mountPoints: { nodeMeta: NodeMeta; env: glassEasel.MountPointEnv }[] = []
  private selectedNodeId = 0

  constructor(conn: Connection) {
    this.conn = conn
    this.init()
  }

  init() {
    this.conn.setRequestHandler('DOM.describeNode', async (args) => {
      let node: dom.Node
      if (args.nodeId !== undefined) {
        const nodeMeta = this.queryActiveNode(args.nodeId)
        node = this.collectNodeDetails(nodeMeta, args.depth ?? 0, false)
      } else if (args.backendNodeId !== undefined) {
        const nodeMeta = this.activateBackendNodeIfNeeded(args.backendNodeId)
        if (!nodeMeta) throw new Error('no such node found')
        node = this.collectNodeDetails(nodeMeta, args.depth ?? 0, false)
      } else {
        throw new Error('missing (backend) node id')
      }
      return { node }
    })

    this.conn.setRequestHandler('DOM.getDocument', async ({ depth }) => {
      let children: dom.Node[] | undefined
      if (depth && depth > 1) {
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
        glassEaselAttributeCount: 0,
        children,
      }
      return { root }
    })

    this.conn.setRequestHandler('DOM.setInspectedNode', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const elem = node.asElement()
      if (!elem) return
      this.selectedNodeId = nodeId
    })

    this.conn.setRequestHandler('DOM.requestChildNodes', async ({ nodeId }) => {
      const nodeMeta = this.queryActiveNode(nodeId)
      this.sendChildNodes(nodeMeta)
    })

    this.conn.setRequestHandler('DOM.getGlassEaselAttributes', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const elem = node.asElement()
      if (!elem) {
        return {
          glassEaselNodeType: GlassEaselNodeType.TextNode,
          is: '',
          id: '',
          class: '',
          slot: '',
          slotName: undefined,
          slotValues: undefined,
          eventBindings: [],
          dataset: [],
          marks: [],
        }
      }

      // element types
      const comp = elem.asGeneralComponent()
      const nativeNode = elem.asNativeNode()
      const virtualNode = elem.asVirtualNode()
      let glassEaselNodeType = GlassEaselNodeType.Unknown
      if (comp) glassEaselNodeType = GlassEaselNodeType.Component
      if (nativeNode) glassEaselNodeType = GlassEaselNodeType.NativeNode
      if (virtualNode) glassEaselNodeType = GlassEaselNodeType.VirtualNode

      // collect basic attributes
      let is = ''
      if (comp) is = comp.is
      if (nativeNode) is = nativeNode.is
      if (virtualNode) is = virtualNode.is
      const id = elem.id
      const nodeClass = elem.class
      const slot = elem.slot
      let slotName
      const maybeSlotName = Reflect.get(elem, '_$slotName') as unknown
      if (typeof maybeSlotName === 'string') slotName = maybeSlotName
      let slotValues: { name: string; value: GlassEaselVar }[] | undefined
      const maybeSlotValues = Reflect.get(elem, '_$slotValues') as unknown
      if (typeof maybeSlotValues === 'object' && maybeSlotValues !== null) {
        slotValues = []
        Object.entries(maybeSlotValues).forEach(([name, value]) => {
          slotValues!.push({ name, value: toGlassEaselVar(value) })
        })
      }

      // collect event bindings
      const eventBindings: {
        name: string
        capture: boolean
        count: number
        hasCatch: boolean
        hasMutBind: boolean
      }[] = []
      type EventPoint = {
        mutCount?: number
        finalCount?: number
        funcArr?: { _$arr?: { f: unknown }[] | null }
      }
      const maybeEventTarget = Reflect.get(elem, '_$eventTarget') as
        | {
            listeners?: { [name: string]: EventPoint }
            captureListeners?: { [name: string]: EventPoint }
          }
        | null
        | undefined
      if (typeof maybeEventTarget === 'object' && maybeEventTarget !== null) {
        const processListeners = (capture: boolean, listeners?: { [name: string]: EventPoint }) => {
          if (typeof listeners === 'object' && listeners !== null) {
            Object.entries(listeners).forEach(([name, value]) => {
              const count = value?.funcArr?._$arr?.length ?? 0
              if (count > 0) {
                const hasCatch = (value?.finalCount ?? 0) > 0
                const hasMutBind = (value?.finalCount ?? 0) > 0
                eventBindings.push({ name, capture, count, hasCatch, hasMutBind })
              }
            })
          }
        }
        processListeners(true, maybeEventTarget.captureListeners)
        processListeners(false, maybeEventTarget.listeners)
      }

      // collect attributes or properties
      let normalAttributes: { name: string; value: GlassEaselVar }[] | undefined
      let properties: { name: string; value: GlassEaselVar }[] | undefined
      if (nativeNode) {
        normalAttributes = []
        elem.attributes.forEach(({ name, value }) => {
          normalAttributes!.push({ name, value: toGlassEaselVar(value) })
        })
      }
      if (comp) {
        properties = []
        const beh = comp.getComponentDefinition().behavior
        const names = beh.listProperties()
        names.forEach((name) => {
          properties!.push({ name, value: toGlassEaselVar(comp.data[name]) })
        })
      }

      // collect dataset
      const dataset: { name: string; value: GlassEaselVar }[] = []
      Object.entries(elem.dataset ?? {}).forEach(([name, value]) => {
        dataset.push({ name, value: toGlassEaselVar(value) })
      })
      const marks: { name: string; value: GlassEaselVar }[] = []
      const maybeMarks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
      Object.entries(maybeMarks ?? {}).forEach(([name, value]) => {
        dataset.push({ name, value: toGlassEaselVar(value) })
      })

      return {
        glassEaselNodeType,
        is,
        id,
        class: nodeClass,
        slot,
        slotName,
        slotValues,
        eventBindings,
        normalAttributes,
        properties,
        dataset,
        marks,
      }
    })

    this.conn.setRequestHandler('DOM.getGlassEaselComposedChildren', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const elem = node.asElement()
      if (!elem) return { nodes: [] }
      const nodes: dom.Node[] = []
      elem.forEachComposedChild((child) => {
        const nodeMeta = this.activateNode(child)
        nodes.push(this.collectNodeDetails(nodeMeta, 0, false))
      })
      return { nodes }
    })

    this.conn.setRequestHandler(
      'DOM.pushNodesByBackendIdsToFrontend',
      async ({ backendNodeIds }) => {
        backendNodeIds.forEach((backendNodeId) => {
          this.activateBackendNodeIfNeeded(backendNodeId)
        })
        return { nodeIds: backendNodeIds }
      },
    )

    this.conn.setRequestHandler('Overlay.setInspectMode', async ({ mode }) => {
      if (mode === 'searchForNode') {
        let prevHighlight = 0
        this.listOverlayComponents().forEach((x) =>
          x.startNodeSelect((node, isFinal) => {
            if (isFinal) {
              this.listOverlayComponents().forEach((x) => x.endNodeSelect())
              if (node) {
                const backendNodeId = this.addBackendNode(node)
                this.conn.sendEvent('Overlay.inspectNodeRequested', {
                  backendNodeId,
                })
              }
              this.conn.sendEvent('Overlay.inspectModeCanceled', {})
            } else {
              let nodeId = node ? this.getNodeId(node) : 0
              if (!this.activeNodes[nodeId]) nodeId = 0
              if (prevHighlight !== nodeId) {
                prevHighlight = nodeId
                this.conn.sendEvent('Overlay.nodeHighlightRequested', { nodeId })
              }
            }
          }),
        )
      }
    })

    this.conn.setRequestHandler('Overlay.highlightNode', async (args) => {
      let node: glassEasel.Node
      if ('nodeId' in args) {
        node = this.queryActiveNode(args.nodeId).node
      } else {
        const n = this.getMaybeBackendNode(args.backendNodeId)
        if (!n) throw new Error('no such node found')
        node = n
      }
      this.listOverlayComponents().forEach((x) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        x.highlight(null)
      })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.getOverlayComponent(node).highlight(node)
    })

    this.conn.setRequestHandler('Overlay.hideHighlight', async () => {
      this.listOverlayComponents().forEach((x) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        x.highlight(null)
      })
    })
  }

  attach(root: glassEasel.Element, env: glassEasel.MountPointEnv) {
    const nodeMeta = this.activateNode(root)
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

  getOverlayComponent(node: glassEasel.Node) {
    const ctx = node.getBackendContext()
    if (!ctx) {
      throw new Error('backend context has been released')
    }
    return this.conn.getOverlayComponent(ctx)
  }

  listOverlayComponents() {
    const ret: ReturnType<Connection['getOverlayComponent']>[] = []
    this.mountPoints.forEach((mp) => {
      const ctx = mp.nodeMeta.node.getBackendContext()
      if (!ctx) return
      const comp = this.conn.getOverlayComponent(ctx)
      if (ret.includes(comp)) return
      ret.push(comp)
    })
    return ret
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

  private getMaybeBackendNode(backendNodeId: NodeId): glassEasel.Node | null {
    const nodeMeta = this.activeNodes[backendNodeId]
    if (nodeMeta) return nodeMeta?.node
    return this.activeBackendNodes[backendNodeId]?.deref() ?? null
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
  private activateNode(node: glassEasel.Node): NodeMeta {
    const nodeId = this.getNodeId(node)
    delete this.activeBackendNodes[nodeId]
    if (this.activeNodes[nodeId]) {
      const nodeMeta = this.activeNodes[nodeId]
      return nodeMeta
    }
    const isMountPoint = this.mountPoints.map((x) => x.nodeMeta.node).includes(node)
    if (!isMountPoint) {
      let p: glassEasel.Node | undefined
      if (node.parentNode) p = node.parentNode
      else if (node.asShadowRoot()) p = node.asShadowRoot()!.getHostNode()
      else p = undefined
      if (p) this.activateNode(p)
    }
    const nodeMeta = { node, nodeId }
    this.activeNodes[nodeId] = nodeMeta
    this.startWatch(node)
    return nodeMeta
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

  private addBackendNode(node: glassEasel.Node): NodeId {
    const nodeId = this.getNodeId(node)
    this.activeBackendNodes[nodeId] = new WeakRef(node)
    return nodeId
  }

  private activateBackendNodeIfNeeded(backendNodeId: NodeId): NodeMeta | null {
    const node = this.activeBackendNodes[backendNodeId]?.deref()
    if (node === undefined) {
      const nodeMeta = this.activeNodes[backendNodeId]
      return nodeMeta ?? null
    }
    return this.activateNode(node)
  }

  // eslint-disable-next-line class-methods-use-this
  private collectNodeBasicInfomation(
    backendNodeId: NodeId,
    node: glassEasel.Node,
  ): dom.BackendNode {
    const ty = getNodeType(node)
    const nodeName = getNodeName(node, ty, false)
    const virtual = node.asElement()?.isVirtual() ?? false
    const inheritSlots = node.asElement()?.isInheritSlots() ?? false
    return {
      backendNodeId,
      nodeType: glassEaselNodeTypeToCDP(ty),
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
    }
  }

  collectNodeDetails(nodeMeta: NodeMeta, depth: number, isMountPoint: boolean): dom.Node {
    const { nodeId, node } = nodeMeta
    const tmplDevAttrs = (
      node as glassEasel.Node & { _$wxTmplDevArgs?: glassEasel.template.TmplDevArgs }
    )._$wxTmplDevArgs

    // collect node information
    const {
      backendNodeId,
      nodeType,
      glassEaselNodeType: ty,
      nodeName,
      virtual,
      inheritSlots,
    } = this.collectNodeBasicInfomation(nodeId, node)
    let parentId: NodeId | undefined
    if (isMountPoint) parentId = this.documentNodeId
    else if (node.parentNode) parentId = this.getNodeId(node.parentNode)
    else if (node.asShadowRoot()) parentId = this.getNodeId(node.asShadowRoot()!.getHostNode())
    else parentId = undefined
    const localName = getNodeName(node, ty, true)
    const nodeValue = node.asTextNode()?.textContent ?? ''

    // collect attributes
    const attributes: string[] = []
    let glassEaselAttributeCount = 0
    let slotName: string | undefined
    if (ty !== GlassEaselNodeType.TextNode) {
      const activeAttrs = tmplDevAttrs?.A
      if (activeAttrs) {
        // show active attributes based on template information
        // TODO
      } else {
        // detect changed attributes
        const elem = node.asElement()!
        if (elem.slot) attributes.push('slot', elem.slot)
        if (elem.id) attributes.push('id', elem.id)
        if (elem.class) attributes.push('class', elem.class)
        if (elem.style) attributes.push('style', elem.style)
        const maybeSlotName = Reflect.get(elem, '_$slotName') as unknown
        if (typeof maybeSlotName === 'string') {
          slotName = maybeSlotName
          attributes.push('name', slotName)
        }
        glassEaselAttributeCount = attributes.length / 2
        if (elem.asNativeNode()) {
          elem.attributes.forEach(({ name, value }) => {
            attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
          })
        }
        Object.entries(elem.dataset ?? {}).forEach(([key, value]) => {
          const name = `data:${key}`
          attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
        })
        const marks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
        Object.entries(marks ?? {}).forEach(([key, value]) => {
          const name = `mark:${key}`
          attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
        })
      }
    }

    // collect shadow-roots
    const sr = node.asGeneralComponent()?.getShadowRoot()
    const shadowRootType = sr ? 'open' : undefined
    let shadowRoots: dom.Node[] | undefined
    if (sr) {
      const nodeMeta = this.activateNode(sr)
      const n = this.collectNodeDetails(nodeMeta, depth - 1, false)
      n.nodeName = 'shadow-root'
      if (n) shadowRoots = [n]
    }

    // collect children
    let children: dom.Node[] | undefined
    if (depth > 1 && ty !== GlassEaselNodeType.TextNode) {
      const elem = node.asElement()!
      children = []
      elem.childNodes.forEach((child) => {
        const nodeMeta = this.activateNode(child)
        const n = this.collectNodeDetails(nodeMeta, depth - 1, false)
        if (n) children!.push(n)
      })
    }

    // collect slot content
    let distributedNodes: dom.BackendNode[] | undefined
    if (typeof slotName === 'string') {
      const elem = node.asElement()!
      distributedNodes = []
      elem.forEachComposedChild((child) => {
        const nodeId = this.addBackendNode(child)
        const n = this.collectNodeBasicInfomation(nodeId, child)
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
      glassEaselAttributeCount,
      shadowRootType,
      shadowRoots,
      children,
      distributedNodes,
    }
  }

  sendChildNodes(nodeMeta: NodeMeta) {
    const { node, nodeId } = nodeMeta
    const elem = node.asElement()
    if (!elem) return
    const nodes: dom.Node[] = []
    elem.childNodes.forEach((child) => {
      const nodeMeta = this.activateNode(child)
      nodes.push(this.collectNodeDetails(nodeMeta, 0, false))
    })
    this.conn.sendEvent('DOM.setChildNodes', { parentId: nodeId, nodes })
  }
}
