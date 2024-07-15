import { DeepCopyKind } from 'glass-easel'
import { initStoreBindings } from 'mobx-miniprogram-bindings'
import { protocol } from 'glass-easel-devtools-agent'
import { childNodeCountUpdated, setChildNodes } from '../../events'
import { sendRequest } from '../../message_channel'
import { warn } from '../../utils'
import { store } from '../store'

type AttributeMeta = { name: string; value: string; isProperty: boolean }

const enum DisplayKind {
  Text = 0,
  Tag = 1,
  VirtualTag = 2,
}

Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
    propertyEarlyInit: true,
  })
  .property('nodeInfo', {
    type: Object,
    value: null as protocol.dom.Node | null,
  })
  .data(() => ({
    kind: DisplayKind.Text,
    textContent: '',
    tagName: '',
    attributes: [] as AttributeMeta[],
    hasShadowRoot: false,
    shadowRoots: [] as protocol.dom.Node[],
    hasChildNodes: true,
    showChildNodes: false,
    children: [] as protocol.dom.Node[],
  }))
  .init((ctx) => {
    const { data, setData, observer, listener } = ctx
    let nodeId = 0
    const initNodeId = (n: protocol.NodeId) => {
      if (n === 0) {
        warn('illegal node id received')
        return
      }
      nodeId = n
    }

    initStoreBindings(ctx, {
      store,
      fields: ['selectedNodeId'],
    })

    childNodeCountUpdated.bindComponentLifetimes(
      ctx,
      () => nodeId,
      (args) => {
        setData({ hasChildNodes: args.childNodeCount > 0 })
      },
    )
    setChildNodes.bindComponentLifetimes(
      ctx,
      () => nodeId,
      (args) => {
        setData({ children: args.nodes })
      },
    )

    observer('nodeInfo', (nodeInfo) => {
      initNodeId(nodeInfo?.nodeId ?? 0)
      const nodeType = nodeInfo?.glassEaselNodeType
      if (
        nodeType === protocol.dom.GlassEaselNodeType.NativeNode ||
        nodeType === protocol.dom.GlassEaselNodeType.Component
      ) {
        const tagName = nodeInfo?.nodeName ?? ''
        const nv = nodeInfo?.attributes ?? []
        const attributes = [] as AttributeMeta[]
        const coreAttrCount = nodeInfo?.glassEaselAttributeCount ?? 0
        for (let i = 0; i < nv.length; i += 2) {
          const name = nv[i]
          const value = nv[i + 1] ?? ''
          const isProperty = i / 2 >= coreAttrCount
          attributes.push({ name, value, isProperty })
        }
        const hasShadowRoot = nodeInfo?.shadowRootType === 'open'
        const shadowRoots = nodeInfo?.shadowRoots ?? []
        setData({
          kind: DisplayKind.Tag,
          tagName,
          attributes,
          hasShadowRoot,
          shadowRoots,
        })
      } else if (nodeType === protocol.dom.GlassEaselNodeType.TextNode) {
        setData({
          kind: DisplayKind.Text,
          textContent: nodeInfo?.nodeValue ?? '',
        })
      } else {
        let tagName = nodeInfo?.nodeName ?? ''
        if (nodeType === protocol.dom.GlassEaselNodeType.ShadowRoot) tagName = 'shadow-root'
        else if (nodeType === protocol.dom.GlassEaselNodeType.Unknown) tagName = 'unknown'
        setData({
          kind: DisplayKind.VirtualTag,
          tagName,
        })
      }
      const children = nodeInfo?.children
      if (children !== undefined) {
        setData({
          hasChildNodes: children.length > 0,
          showChildNodes: true,
          children,
        })
      }
    })

    const toggleChildren = listener(() => {
      if (!data.showChildNodes) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendRequest('DOM.requestChildNodes', { nodeId })
      }
      setData({
        showChildNodes: !data.showChildNodes,
        children: [],
      })
    })

    const selectTag = listener(() => {
      store.selectNode(nodeId)
    })

    return { toggleChildren, selectTag }
  })
  .register()
