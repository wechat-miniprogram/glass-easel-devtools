import { DeepCopyKind } from 'glass-easel'
import { initStoreBindings } from 'mobx-miniprogram-bindings'
import { type protocol, sendRequest } from '../../message_channel'
import { store } from '../store'

export const componentDefinition = Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
  })
  .data(() => ({
    mountPoints: [] as protocol.dom.Node[],
  }))
  .init((ctx) => {
    const { setData, method, listener } = ctx

    const initDocument = async () => {
      await sendRequest('DOM.enable', {})
      const res = await sendRequest('DOM.getDocument', { depth: 3 })
      setData({ mountPoints: res.root.children ?? [] })
    }

    initStoreBindings(ctx, { store, fields: ['selectedNodeId'] })

    const treeSpaceTap = listener(() => {
      store.selectNode(0)
    })

    // reconnect, clear elements, and fetch all elements
    const restart = method(() => {
      setData({ mountPoints: [] })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initDocument()
    })

    return {
      treeSpaceTap,
      restart,
    }
  })
  .register()
