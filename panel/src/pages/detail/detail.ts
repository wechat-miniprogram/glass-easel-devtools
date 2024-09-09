import { DeepCopyKind } from 'glass-easel'
import { autorun } from 'mobx-miniprogram'
import { protocol, sendRequest } from '../../message_channel'
import { store } from '../store'
import { attributeModified } from '../../events'

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
    stylePropertyAddRuleIndex: null as number | null,
    computedStyles: null as null | { name: string; value: string }[],
    computedStyleCollapsed: true,
  }))
  .init(({ self, data, setData, lifetime, method, listener }) => {
    lifetime('attached', () => {
      autorun(async () => {
        const nodeId = store.selectedNodeId
        if (!nodeId) {
          setData({ info: DEFAULT_NODE_DATA })
          return
        }

        // register attributes listeners
        updateListener(nodeId)

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

    let listeningNodeId = 0
    const updateListenerFunc = (args: protocol.dom.AttributeModified['detail']) => {
      const { name, value, detail, nameType } = args
      if (nameType === 'attribute') {
        const index = data.info.normalAttributes?.map((x) => x.name).indexOf(name) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(
              ['info', 'normalAttributes', index, 'value'],
              detail as unknown as never,
            )
          })
        }
      } else if (nameType === 'component-property') {
        const index = data.info.properties?.map((x) => x.name).indexOf(name) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(
              ['info', 'properties', index, 'value'],
              detail as unknown as never,
            )
          })
        }
      } else if (nameType === 'slot-value') {
        const index = data.info.slotValues?.map((x) => x.name).indexOf(name) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(
              ['info', 'slotValues', index, 'value'],
              detail as unknown as never,
            )
          })
        }
      } else if (nameType === 'dataset' && name.startsWith('data:')) {
        const index = data.info.dataset.map((x) => x.name).indexOf(name.slice(5)) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(['info', 'dataset', index, 'value'], detail)
          })
        }
      } else if (nameType === 'mark' && name.startsWith('mark:')) {
        const index = data.info.marks.map((x) => x.name).indexOf(name.slice(5)) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(['info', 'marks', index, 'value'], detail)
          })
        }
      } else if (nameType === 'external-class') {
        const index = data.info.externalClasses?.map((x) => x.name).indexOf(name) ?? -1
        if (index >= 0) {
          self.groupUpdates(() => {
            self.replaceDataOnPath(
              ['info', 'externalClasses', index, 'value'],
              value as unknown as never,
            )
          })
        }
      } else if (name === 'slot') {
        self.groupUpdates(() => {
          self.replaceDataOnPath(['info', 'slot'], value)
        })
      } else if (name === 'id') {
        self.groupUpdates(() => {
          self.replaceDataOnPath(['info', 'id'], value)
        })
      } else if (name === 'class') {
        self.groupUpdates(() => {
          self.replaceDataOnPath(['info', 'class'], value)
        })
      } else if (name === 'name') {
        self.groupUpdates(() => {
          self.replaceDataOnPath(['info', 'slotName'], value)
        })
      }
    }
    const updateListener = (nodeId: protocol.NodeId) => {
      if (listeningNodeId) {
        attributeModified.removeListener(listeningNodeId, updateListenerFunc)
      }
      if (nodeId) {
        attributeModified.addListener(nodeId, updateListenerFunc)
      }
      listeningNodeId = nodeId
    }

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

    const styleChange = listener<{ value: string }>((ev) => {
      const nodeId = store.selectedNodeId
      const { matchedRuleIndex, propertyIndex } = ev.mark as {
        matchedRuleIndex: number | undefined
        propertyIndex: number
      }
      let styleSheetId: string | undefined
      let ruleIndex = 0
      if (matchedRuleIndex) {
        const rule = data.styles?.matchedCSSRules[matchedRuleIndex]?.rule
        if (!rule) return
        styleSheetId = rule.styleSheetId
        ruleIndex = rule.ruleIndex
      }
      const styleText = ev.detail.value
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      Promise.resolve().then(async () => {
        await sendRequest('CSS.replaceGlassEaselStyleSheetProperty', {
          nodeId,
          styleSheetId,
          ruleIndex,
          propertyIndex,
          styleText,
        })
        await refreshStyles()
        return undefined
      })
    })

    const styleDisable = listener((ev) => {
      const nodeId = store.selectedNodeId
      const { matchedRuleIndex, propertyIndex, toDisable } = ev.mark as {
        matchedRuleIndex: number | undefined
        propertyIndex: number
        toDisable: boolean
      }
      let styleSheetId: string | undefined
      let ruleIndex = 0
      if (matchedRuleIndex) {
        const rule = data.styles?.matchedCSSRules[matchedRuleIndex]?.rule
        if (!rule) return
        styleSheetId = rule.styleSheetId
        ruleIndex = rule.ruleIndex
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      Promise.resolve().then(async () => {
        await sendRequest('CSS.setGlassEaselStyleSheetPropertyDisabled', {
          nodeId,
          styleSheetId,
          ruleIndex,
          propertyIndex,
          disabled: toDisable,
        })
        await refreshStyles()
        return undefined
      })
    })

    const styleAddProperty = listener((ev) => {
      const { matchedRuleIndex } = ev.mark as {
        matchedRuleIndex: number | undefined
      }
      setData({
        stylePropertyAddRuleIndex: matchedRuleIndex ?? -1,
      })
    })

    const styleAddPropertyApply = listener<{ value: string }>((ev) => {
      const nodeId = store.selectedNodeId
      const { matchedRuleIndex } = ev.mark as {
        matchedRuleIndex: number | undefined
      }
      let styleSheetId: string | undefined
      let ruleIndex = 0
      if (matchedRuleIndex) {
        const rule = data.styles?.matchedCSSRules[matchedRuleIndex]?.rule
        if (!rule) return
        styleSheetId = rule.styleSheetId
        ruleIndex = rule.ruleIndex
      }
      const styleText = ev.detail.value
      setData({ stylePropertyAddRuleIndex: null })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      Promise.resolve().then(async () => {
        await sendRequest('CSS.addGlassEaselStyleSheetProperty', {
          nodeId,
          styleSheetId,
          ruleIndex,
          styleText,
        })
        await refreshStyles()
        return undefined
      })
    })

    return {
      refreshBoxModel,
      refreshStyles,
      refreshComputedStyles,
      styleChange,
      styleDisable,
      styleAddProperty,
      styleAddPropertyApply,
    }
  })
  .register()
