import { DeepCopyKind } from 'glass-easel'
import { autorun } from 'mobx-miniprogram'
import { protocol, sendRequest } from '../../message_channel'
import { store } from '../store'

const DEFAULT_NODE_DATA = {
  glassEaselNodeType: 0,
  virtual: true,
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

Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
  })
  .data(() => ({
    nodeId: 0 as protocol.NodeId,
    nodeTypeName: '',
    info: DEFAULT_NODE_DATA as protocol.dom.GetGlassEaselAttributes['response'],
    boxModel: null as null | protocol.dom.GetBoxModel['response'],
    boxModelCollapsed: false,
    styles: null as null | protocol.css.GetMatchedStylesForNode['response'],
    styleCollapsed: false,
    computedStyles: null as null | { name: string; value: string }[],
    computedStyleCollapsed: true,
  }))
  .init(({ data, setData, lifetime, method }) => {
    lifetime('attached', () => {
      autorun(async () => {
        const nodeId = store.selectedNodeId
        if (!nodeId) {
          setData({ info: DEFAULT_NODE_DATA })
          return
        }

        // fetch normal attributes
        const info = await sendRequest('DOM.getGlassEaselAttributes', { nodeId })
        if (store.selectedNodeId !== nodeId) return
        let nodeTypeName = 'Node (unknown)'
        if (info.glassEaselNodeType === protocol.dom.GlassEaselNodeType.Component) {
          nodeTypeName = 'Component'
        } else if (info.glassEaselNodeType === protocol.dom.GlassEaselNodeType.NativeNode) {
          nodeTypeName = 'Native Node'
        } else if (info.glassEaselNodeType === protocol.dom.GlassEaselNodeType.VirtualNode) {
          nodeTypeName = 'Virtual Node'
        } else if (info.glassEaselNodeType === protocol.dom.GlassEaselNodeType.TextNode) {
          nodeTypeName = 'Text Node'
        }
        setData({ nodeId, nodeTypeName, info })

        // fetch box model
        if (!data.boxModelCollapsed) {
          await refreshBoxModel()
        }

        // fetch style
        if (!data.styleCollapsed) {
          await refreshStyles()
        }

        // fetch computed style
        if (!data.computedStyleCollapsed) {
          await refreshComputedStyles()
        }
      })
    })

    const refreshBoxModel = method(async () => {
      const nodeId = store.selectedNodeId
      const boxModel = data.info.virtual ? null : await sendRequest('DOM.getBoxModel', { nodeId })
      setData({ boxModel })
    })

    const refreshStyles = method(async () => {
      const nodeId = store.selectedNodeId
      const styles = data.info.virtual
        ? null
        : await sendRequest('CSS.getMatchedStylesForNode', { nodeId })
      setData({ styles })
    })

    const refreshComputedStyles = method(async () => {
      const nodeId = store.selectedNodeId
      const computedStyles = data.info.virtual
        ? null
        : (await sendRequest('CSS.getComputedStyleForNode', { nodeId })).computedStyle
      setData({ computedStyles })
    })

    return { refreshBoxModel, refreshStyles, refreshComputedStyles }
  })
  .register()
