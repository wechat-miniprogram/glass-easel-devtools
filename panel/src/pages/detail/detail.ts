import { DeepCopyKind } from 'glass-easel'
import { autorun } from 'mobx-miniprogram'
import { type protocol, sendRequest } from '../../message_channel'
import { store } from '../store'

const DEFAULT_NODE_DATA = {
  glassEaselNodeType: 0,
  is: '',
  id: '',
  slot: '',
  slotName: undefined,
  slotValues: undefined,
  eventBindings: [],
  dataset: [],
  marks: [],
}

export const componentDefinition = Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
  })
  .data(() => ({
    info: DEFAULT_NODE_DATA as protocol.dom.GetGlassEaselAttributes['response'],
  }))
  .init(({ setData, lifetime }) => {
    lifetime('attached', () => {
      autorun(async () => {
        const nodeId = store.selectedNodeId
        if (!nodeId) {
          setData({ info: DEFAULT_NODE_DATA })
          return
        }
        const info = await sendRequest('DOM.getGlassEaselAttributes', { nodeId })
        if (store.selectedNodeId !== nodeId) return
        setData({ info })
      })
    })
  })
  .register()
