import * as glassEasel from 'glass-easel'
import { type protocol, type Connection } from '.'
import {
  type GlassEaselVar,
  glassEaselVarToString,
  toGlassEaselVar,
  type NodeId,
  type dom,
} from './protocol'
import { GlassEaselNodeType, glassEaselNodeTypeToCDP } from './protocol/dom'
import * as backendUtils from './backend'
import { warn } from './utils'

export type NodeMeta = {
  node: glassEasel.Node
  nodeId: NodeId
  childNodesSent: boolean
  observer: glassEasel.MutationObserver
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
          virtual: false,
          is: '',
          id: '',
          classes: [],
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
      const virtual = elem.isVirtual()
      let is = ''
      if (comp) is = comp.is
      if (nativeNode) is = nativeNode.is
      if (virtualNode) is = virtualNode.is
      const id = elem.id
      const classEdit = backendUtils.classEditContext.createOrGet('', elem)
      const classes = classEdit.update(elem.class.split(/\s+/g).filter((x) => x)).getClasses()
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

      // collect attributes, properties, and external classes
      let normalAttributes: { name: string; value: GlassEaselVar }[] | undefined
      let properties: { name: string; value: GlassEaselVar }[] | undefined
      let externalClasses:
        | { name: string; value: { className: string; disabled?: boolean }[] }[]
        | undefined
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
        const ec = comp.getExternalClasses()
        if (ec) {
          externalClasses = Object.entries(ec).map(([name, value]) => ({
            name,
            value: backendUtils.classEditContext
              .createOrGet(name, elem)
              .update(value ?? [])
              .getClasses(),
          }))
        }
      }

      // collect dataset
      const dataset: { name: string; value: GlassEaselVar }[] = []
      Object.entries(elem.dataset ?? {}).forEach(([name, value]) => {
        dataset.push({ name, value: toGlassEaselVar(value) })
      })
      const marks: { name: string; value: GlassEaselVar }[] = []
      const maybeMarks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
      Object.entries(maybeMarks ?? {}).forEach(([name, value]) => {
        marks.push({ name, value: toGlassEaselVar(value) })
      })

      return {
        glassEaselNodeType,
        virtual,
        is,
        id,
        classes,
        slot,
        slotName,
        slotValues,
        eventBindings,
        normalAttributes,
        properties,
        externalClasses,
        dataset,
        marks,
      }
    })

    this.conn.setRequestHandler(
      'DOM.setAttributeValue',
      async ({ nodeId, name, value, nameType }) => {
        const { node } = this.queryActiveNode(nodeId)
        const elem = node.asElement()
        if (!elem) return undefined
        if (nameType === 'normal-attribute') {
          elem.setAttribute(name, value)
        } else if (nameType === 'property') {
          const comp = elem.asGeneralComponent()
          comp?.setData({ [name]: value })
        } else if (nameType === 'external-class') {
          const comp = elem.asGeneralComponent()
          comp?.setExternalClass(name, value)
        } else if (name === 'id') {
          elem.id = value
        } else if (name === 'class') {
          elem.class = value
        } else if (name === 'slot') {
          elem.slot = value
        } else if (name.indexOf(':') >= 0) {
          const [scope, key] = name.split(':', 2)
          if (scope === 'dataset') {
            elem.setDataset(key, value)
          } else if (scope === 'mark') {
            elem.setMark(key, value)
          }
        } else {
          const comp = elem.asGeneralComponent()
          if (comp) {
            const beh = comp.getComponentDefinition().behavior
            if (beh.listProperties().includes(name)) {
              comp.setData({ [name]: value })
            } else if (Object.keys(comp.getExternalClasses()).includes(name)) {
              comp.setExternalClass(name, value)
            }
          }
          elem.setAttribute(name, value)
        }
        return undefined
      },
    )

    this.conn.setRequestHandler(
      'DOM.setGlassEaselClassList',
      async ({ nodeId, externalClass, classes }) => {
        const { node } = this.queryActiveNode(nodeId)
        const elem = node.asElement()
        if (!elem) return { classes: [] }
        const edit = backendUtils.classEditContext.createOrGet(externalClass ?? '', elem)
        edit.setClasses(classes)
        if (externalClass) {
          const comp = elem.asGeneralComponent()
          comp?.setExternalClass(externalClass, edit.stringify())
        } else {
          elem.class = edit.stringify()
        }
        return { classes: edit.getClasses() }
      },
    )

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

    this.conn.setRequestHandler('DOM.getBoxModel', async (args) => {
      let node: glassEasel.Node | null
      if ('nodeId' in args) {
        node = this.queryActiveNode(args.nodeId).node
      } else {
        node = this.getMaybeBackendNode(args.backendNodeId)
      }
      const ctx = node?.getBackendContext()
      const elem = node?.getBackendElement()
      if (!ctx || !elem) {
        throw new Error('no such backend node found')
      }
      const { margin, border, padding, content } = await backendUtils.getBoxModel(ctx, elem)
      const toQuad = (x: backendUtils.BoundingClientRect) => {
        const lt = [x.left, x.top]
        const rt = [x.left + x.width, x.top]
        const lb = [x.left, x.top + x.height]
        const rb = [x.left + x.width, x.top + x.height]
        return [...lt, ...rt, ...rb, ...lb] as protocol.dom.Quad
      }
      return {
        margin: toQuad(margin),
        border: toQuad(border),
        padding: toQuad(padding),
        content: toQuad(content),
        width: border.width,
        height: border.height,
      }
    })

    this.conn.setRequestHandler('DOM.useGlassEaselElementInConsole', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const varName = this.useInConsole(node)
      return { varName }
    })

    this.conn.setRequestHandler(
      'DOM.useGlassEaselAttributeInConsole',
      async ({ nodeId, attribute }) => {
        const { node } = this.queryActiveNode(nodeId)
        let attr: unknown
        const elem = node.asElement()
        if (!elem) throw new Error('not an element')
        if (attribute.startsWith('data:')) {
          attr = elem.dataset[attribute.slice(5)]
        } else if (attribute.startsWith('mark:')) {
          const maybeMarks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
          attr = maybeMarks?.[attribute.slice(5)]
        } else {
          const comp = elem.asGeneralComponent()
          if (comp) {
            attr = comp.data[attribute]
          } else {
            attr = elem.attributes.find(({ name }) => name === attribute)?.value
          }
        }
        const varName = this.useInConsole(attr)
        return { varName }
      },
    )

    this.conn.setRequestHandler('CSS.getComputedStyleForNode', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const ctx = node?.getBackendContext()
      const elem = node?.getBackendElement()
      if (!ctx || !elem) {
        throw new Error('no such backend node found')
      }
      const computedStyle = (await backendUtils.getAllComputedStyles(ctx, elem)).properties
      return { computedStyle }
    })

    this.conn.setRequestHandler('CSS.getMatchedStylesForNode', async ({ nodeId }) => {
      const { node } = this.queryActiveNode(nodeId)
      const elem = node.asElement()
      if (!elem) {
        throw new Error('not an element')
      }
      const { inline, inlineText, rules, crossOriginFailing } = await backendUtils.getMatchedRules(
        elem,
      )
      const inlineStyle = { cssProperties: inline, cssText: inlineText }
      const matchedCSSRules = rules.map((rule) => ({
        rule: {
          selectorList: { selectors: [{ text: rule.selector }], text: rule.selector },
          style: { cssProperties: rule.properties, cssText: rule.propertyText },
          media: rule.mediaQueries.map((x) => ({ text: x })),
          inactive: rule.inactive || false,
          styleSheetId: rule.sheetIndex.toString(),
          ruleIndex: rule.ruleIndex,
          styleScope: rule.styleScope,
        },
      }))
      return { inlineStyle, matchedCSSRules, inherited: [], crossOriginFailing }
    })

    this.conn.setRequestHandler(
      'CSS.replaceGlassEaselStyleSheetProperty',
      async ({ nodeId, styleSheetId, ruleIndex, propertyIndex, styleText }) => {
        const { node } = this.queryActiveNode(nodeId)
        const ctx = node?.getBackendContext()
        const elem = node?.getBackendElement()
        if (!ctx || !elem) {
          throw new Error('no such backend node found')
        }
        const editFunc = (edit: backendUtils.StyleRuleEdit) => {
          edit.replace(propertyIndex, styleText)
        }
        if (styleSheetId !== undefined) {
          const sheetIndex = Number(styleSheetId)
          await backendUtils.styleEditContext.updateRule(ctx, sheetIndex, ruleIndex, editFunc)
        } else {
          backendUtils.styleEditContext.updateInline(ctx, elem, editFunc)
        }
      },
    )

    this.conn.setRequestHandler(
      'CSS.addGlassEaselStyleSheetProperty',
      async ({ nodeId, styleSheetId, ruleIndex, styleText }) => {
        const { node } = this.queryActiveNode(nodeId)
        const ctx = node?.getBackendContext()
        const elem = node?.getBackendElement()
        if (!ctx || !elem) {
          throw new Error('no such backend node found')
        }
        const editFunc = (edit: backendUtils.StyleRuleEdit) => {
          edit.append(styleText)
        }
        if (styleSheetId !== undefined) {
          const sheetIndex = Number(styleSheetId)
          await backendUtils.styleEditContext.updateRule(ctx, sheetIndex, ruleIndex, editFunc)
        } else {
          backendUtils.styleEditContext.updateInline(ctx, elem, editFunc)
        }
      },
    )

    this.conn.setRequestHandler(
      'CSS.setGlassEaselStyleSheetPropertyDisabled',
      async ({ nodeId, styleSheetId, ruleIndex, propertyIndex, disabled }) => {
        const { node } = this.queryActiveNode(nodeId)
        const ctx = node?.getBackendContext()
        const elem = node?.getBackendElement()
        if (!ctx || !elem) {
          throw new Error('no such backend node found')
        }
        const editFunc = (edit: backendUtils.StyleRuleEdit) => {
          edit.setDisabled(propertyIndex, disabled)
        }
        if (styleSheetId !== undefined) {
          const sheetIndex = Number(styleSheetId)
          await backendUtils.styleEditContext.updateRule(ctx, sheetIndex, ruleIndex, editFunc)
        } else {
          backendUtils.styleEditContext.updateInline(ctx, elem, editFunc)
        }
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
      } else {
        this.listOverlayComponents().forEach((x) => x.endNodeSelect())
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

  // eslint-disable-next-line class-methods-use-this
  private useInConsole(v: unknown): string {
    let i = 0
    while (i <= 0xffffffff) {
      const varName = `temp${i}`
      if (!Object.prototype.hasOwnProperty.call(globalThis, varName)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ;(globalThis as any)[varName] = v
        // eslint-disable-next-line no-console
        console.log(varName, v)
        return varName
      }
      i += 1
    }
    return ''
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
    const observer = glassEasel.MutationObserver.create((ev) => {
      const node = ev.target
      const nodeId = this.getNodeId(node)
      const nodeMeta = this.activeNodes[nodeId]
      if (!nodeMeta) return
      if (ev.type === 'properties') {
        const elem = node.asElement()!
        const nameType = ev.nameType
        if (nameType === 'attribute') {
          const name = ev.attributeName ?? ''
          const v = elem.getAttribute(name)
          if (v === null || v === 'undefined') {
            this.conn.sendEvent('DOM.attributeRemoved', { nodeId, name, nameType })
          } else {
            const detail = toGlassEaselVar(v)
            const value = glassEaselVarToString(detail)
            this.conn.sendEvent('DOM.attributeModified', {
              nodeId,
              name,
              value,
              detail,
              nameType,
            })
          }
        } else {
          let name: string | undefined
          let v: unknown
          if (nameType === 'component-property') {
            name = ev.propertyName ?? ''
            v = elem.asGeneralComponent()?.data[name]
          } else if (nameType === 'slot-value') {
            name = ev.propertyName ?? ''
            const maybeSlotValues = Reflect.get(elem, '_$slotValues') as unknown
            if (typeof maybeSlotValues === 'object' && maybeSlotValues !== null) {
              v = (maybeSlotValues as { [name: string]: unknown })[name]
            }
          } else if (nameType === 'dataset' && ev.attributeName?.startsWith('data:')) {
            name = ev.attributeName ?? ''
            v = elem.dataset[name.slice(5)]
          } else if (nameType === 'mark' && ev.attributeName?.startsWith('mark:')) {
            name = ev.attributeName ?? ''
            const marks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
            v = marks?.[name.slice(5)]
          } else if (nameType === 'external-class') {
            const external = ev.attributeName ?? ''
            const classes = elem.asGeneralComponent()?.getExternalClasses()?.[external]?.join(' ')
            if (!backendUtils.classEditContext.createOrGet(external, elem)) {
              name = external
              v = classes ?? ''
            }
          } else if (ev.attributeName === 'slot') {
            name = ev.attributeName
            v = elem.slot
          } else if (ev.attributeName === 'id') {
            name = ev.attributeName
            v = elem.id
          } else if (ev.attributeName === 'class') {
            if (!backendUtils.classEditContext.createOrGet('', elem).matches(elem.class)) {
              name = ev.attributeName
              v = elem.class
            }
          } else if (ev.attributeName === 'style') {
            name = ev.attributeName
            v = elem.style
          } else if (ev.attributeName === 'name') {
            name = ev.attributeName
            v = Reflect.get(elem, '_$slotName')
          }
          if (name) {
            const detail = toGlassEaselVar(v)
            const value = glassEaselVarToString(detail)
            this.conn.sendEvent('DOM.attributeModified', {
              nodeId,
              name,
              value,
              detail,
              nameType,
            })
          }
        }
        return
      }
      if (ev.type === 'childList') {
        if (!nodeMeta.childNodesSent) return
        const parent = node.asElement()!
        ev.addedNodes?.forEach((child) => {
          const index = parent.childNodes.indexOf(child)
          if (index < 0) return
          const previousNodeId = index === 0 ? 0 : this.getNodeId(parent.childNodes[index - 1])
          const childMeta = this.activateNode(child)
          this.conn.sendEvent('DOM.childNodeInserted', {
            parentNodeId: nodeId,
            previousNodeId,
            node: this.collectNodeDetails(childMeta, 0, false),
          })
        })
        ev.removedNodes?.forEach((child) => {
          this.deactivateNodeTree(child)
          this.conn.sendEvent('DOM.childNodeRemoved', {
            parentNodeId: nodeId,
            nodeId: this.getNodeId(child),
          })
        })
        return
      }
      if (ev.type === 'characterData') {
        this.conn.sendEvent('DOM.characterDataModified', {
          nodeId,
          characterData: node.asTextNode()!.textContent,
        })
        return
      }
      warn('unknown mutation observer event')
    })
    observer.observe(node, { properties: 'all', characterData: true, childList: true })
    return observer
  }

  // eslint-disable-next-line class-methods-use-this
  private endWatch(observer: glassEasel.MutationObserver) {
    observer.disconnect()
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
    const observer = this.startWatch(node)
    const nodeMeta = { node, nodeId, observer, childNodesSent: false }
    this.activeNodes[nodeId] = nodeMeta
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
    const { observer } = this.activeNodes[nodeId]
    this.endWatch(observer)
    const shadowRoot = node.asGeneralComponent()?.getShadowRoot?.()
    if (shadowRoot) this.deactivateNodeTree(shadowRoot)
    const childNodes: glassEasel.Node[] | undefined = (node as glassEasel.Element).childNodes
    if (childNodes) {
      childNodes.forEach((node) => this.deactivateNodeTree(node))
    }
    delete this.activeNodes[nodeId]
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
      const elem = node.asElement()!
      if (activeAttrs) {
        // show active attributes based on template information
        activeAttrs.forEach((name) => {
          if (name[0] === ':') {
            if (name === ':slot') attributes.push('slot', elem.slot)
            if (name === ':id') attributes.push('id', elem.id)
            if (name === ':class') attributes.push('class', elem.class)
            if (name === ':style') attributes.push('style', elem.style)
            if (name === ':name') attributes.push('style', Reflect.get(elem, '_$slotName'))
          } else if (name.startsWith('data:')) {
            const value = elem.dataset?.[name.slice(5)]
            attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
          } else if (name.startsWith('mark:')) {
            const marks = Reflect.get(elem, '_$marks') as { [key: string]: unknown } | undefined
            const value = marks?.[name.slice(5)]
            attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
          } else if (name.indexOf(':') < 0) {
            if (elem.asNativeNode()) {
              const value = elem.attributes.find(({ name: n }) => name === n)?.value
              attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
            } else if (elem.asGeneralComponent()) {
              const comp = elem.asGeneralComponent()!
              if (comp.getComponentDefinition().behavior.getPropertyType(name) !== undefined) {
                const value = comp.data[name] as unknown
                attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
              } else if (comp.hasExternalClass(name)) {
                const value = comp.getExternalClasses()[name]?.join(' ')
                attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
              }
            } else if (typeof Reflect.get(elem, '_$slotName') === 'string') {
              const maybeSlotValues = Reflect.get(elem, '_$slotValues') as unknown
              if (typeof maybeSlotValues === 'object' && maybeSlotValues !== null) {
                const value = (maybeSlotValues as { [name: string]: unknown })[name]
                attributes.push(name, glassEaselVarToString(toGlassEaselVar(value)))
              }
            }
          }
        })
      } else {
        // detect changed attributes
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
      nodeMeta.childNodesSent = true
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
    nodeMeta.childNodesSent = true
    const nodes: dom.Node[] = []
    elem.childNodes.forEach((child) => {
      const nodeMeta = this.activateNode(child)
      nodes.push(this.collectNodeDetails(nodeMeta, 0, false))
    })
    this.conn.sendEvent('DOM.setChildNodes', { parentId: nodeId, nodes })
  }
}
