import { DeepCopyKind } from 'glass-easel'
import { initStoreBindings } from 'mobx-miniprogram-bindings'
import { protocol } from 'glass-easel-devtools-agent'
import {
  childNodeCountUpdated,
  childNodeInserted,
  childNodeRemoved,
  setChildNodes,
  characterDataModified,
  attributeModified,
} from '../../events'
import { sendRequest } from '../../message_channel'
import { error, warn } from '../../utils'
import { store } from '../store'

type AttributeMeta = { name: string; value: string; isProperty: boolean; updateAniTs: number }

const enum DisplayKind {
  Text = 0,
  Tag = 1,
  VirtualTag = 2,
}

export const compDef = Component()
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
    hasSlotContent: false,
    showChildNodes: false,
    children: [] as protocol.dom.Node[],
    tagVarName: '',
    tagUpdateHighlight: false,
  }))
  .init((ctx) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { self, data, setData, observer, listener, method } = ctx
    let nodeId = 0
    const initNodeId = (n: protocol.NodeId) => {
      if (n === 0) {
        warn('illegal node id received')
        return
      }
      nodeId = n
    }

    // store bindings
    initStoreBindings(ctx, {
      store,
      fields: ['selectedNodeId', 'highlightNodeId'],
    })

    // child nodes listeners
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
      ({ nodes }) => {
        setData({
          hasChildNodes: nodes.length > 0,
          children: nodes,
        })
      },
    )
    childNodeInserted.bindComponentLifetimes(
      ctx,
      () => nodeId,
      ({ previousNodeId, node }) => {
        const after = data.children.map((x) => x.nodeId).indexOf(previousNodeId)
        const before = after + 1
        self.groupUpdates(() => {
          self.spliceArrayDataOnPath(['children'], before, 0, [node])
        })
        const childComp = self.selectComponent(`#child-${node.nodeId}`, compDef)
        childComp?.tagUpdatedAni()
      },
    )
    childNodeRemoved.bindComponentLifetimes(
      ctx,
      () => nodeId,
      ({ nodeId: childNodeId }) => {
        const index = data.children.map((x) => x.nodeId).indexOf(childNodeId)
        if (index < 0) return
        self.groupUpdates(() => {
          self.spliceArrayDataOnPath(['children'], index, 1, [])
        })
        tagUpdatedAni()
      },
    )
    characterDataModified.bindComponentLifetimes(
      ctx,
      () => nodeId,
      ({ characterData }) => {
        setData({ textContent: characterData })
        tagUpdatedAni()
      },
    )
    let updateAniEndTimeout = 0
    const tagUpdatedAni = method(() => {
      setTimeout(() => {
        if (data.tagUpdateHighlight) {
          setData({ tagUpdateHighlight: false })
          tagUpdatedAni()
          return
        }
        if (updateAniEndTimeout) {
          clearTimeout(updateAniEndTimeout)
          updateAniEndTimeout = 0
        }
        self.setData({ tagUpdateHighlight: true })
        updateAniEndTimeout = setTimeout(() => {
          updateAniEndTimeout = 0
          setData({ tagUpdateHighlight: false })
        }, 1000)
      }, 200)
    })

    // attribute listeners
    attributeModified.bindComponentLifetimes(
      ctx,
      () => nodeId,
      ({ name, value }) => {
        data.attributes.forEach((attr, index) => {
          if (attr.name === name) {
            self.groupUpdates(() => {
              self.replaceDataOnPath(['attributes', index, 'value'], value)
            })
            attrUpdatedAni(index)
          }
        })
      },
    )
    const attrUpdatedAni = (index: number) => {
      setTimeout(() => {
        if (data.attributes[index].updateAniTs) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(['attributes', index, 'updateAniTs'], 0)
          })
          attrUpdatedAni(index)
          return
        }
        const now = Date.now()
        self.groupUpdates(() => {
          self.replaceDataOnPath(['attributes', index, 'updateAniTs'], now)
        })
        updateAniEndTimeout = setTimeout(() => {
          if (data.attributes[index].updateAniTs !== now) return
          self.groupUpdates(() => {
            self.replaceDataOnPath(['attributes', index, 'updateAniTs'], 0)
          })
        }, 1000)
      }, 200)
    }

    // init node info
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
          attributes.push({ name, value, isProperty, updateAniTs: 0 })
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
        if (nodeType === protocol.dom.GlassEaselNodeType.Unknown) tagName = 'unknown'
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
      const distributedNodes = nodeInfo?.distributedNodes
      if (distributedNodes !== undefined) {
        setData({
          hasSlotContent: distributedNodes.length > 0,
          showChildNodes: false,
        })
      }
    })

    // toggle children events
    const updateChildren = async () => {
      const distributedNodes = data.nodeInfo?.distributedNodes
      if (distributedNodes) {
        const { nodes } = await sendRequest('DOM.getGlassEaselComposedChildren', { nodeId })
        setData({ children: nodes })
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendRequest('DOM.requestChildNodes', { nodeId })
      }
    }
    const toggleChildren = listener(() => {
      setData({
        showChildNodes: !data.showChildNodes,
      })
      if (data.showChildNodes) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
        Promise.resolve().then(updateChildren)
      }
    })
    const visitChildNodePath = method(async (nodePath: protocol.dom.Node[]) => {
      const [node, ...childPath] = nodePath
      if (childPath.length === 0) {
        setData({ children: node.children })
        store.selectNode(nodeId)
        return
      }
      setData({
        showChildNodes: true,
        children: node.children,
      })
      const childComp = self.selectComponent(`#child-${childPath[0].nodeId}`, compDef)
      if (childComp) {
        await childComp.visitChildNodePath(childPath)
      } else {
        error(`cannot find child node id ${childPath[0].nodeId}`)
      }
    })

    // tag events
    const selectTag = listener(() => {
      store.selectNode(nodeId)
    })
    const startHoverTag = listener(() => {
      store.setHighlightNode(nodeId)
    })
    const endHoverTag = listener(() => {
      if (store.highlightNodeId === nodeId) store.setHighlightNode(0)
    })
    const useElementInConsole = method(async () => {
      const { varName } = await sendRequest('DOM.useGlassEaselElementInConsole', { nodeId })
      setData({ tagVarName: varName })
    })

    return {
      toggleChildren,
      visitChildNodePath,
      selectTag,
      startHoverTag,
      endHoverTag,
      useElementInConsole,
      tagUpdatedAni,
    }
  })
  .register()
