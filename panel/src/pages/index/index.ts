import { DeepCopyKind } from 'glass-easel'
import { type protocol, sendRequest } from '../../message_channel'

export const componentDefinition = Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
  })
  .data(() => ({
    mountPoints: [] as protocol.dom.Node[],
  }))
  .init(({ setData, method }) => {
    const initDocument = async () => {
      await sendRequest('DOM.enable', {})
      const res = await sendRequest('DOM.getDocument', { depth: 1 })
      setData({ mountPoints: res.root.children ?? [] })
    }

    // reconnect, clear elements, and fetch all elements
    const restart = method(() => {
      setData({ mountPoints: [] })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initDocument()
    })

    return {
      restart,
    }
  })
  .register()
