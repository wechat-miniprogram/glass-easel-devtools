import { sendRequest, setEventHandler } from '../../message_channel'

setEventHandler('DOM.childNodeInserted', () => {
  // TODO
})

setEventHandler('DOM.childNodeCountUpdated', () => {
  /* empty */
})

export const componentDefinition = Component()
  .data(() => ({}))
  .init(({ data, setData, method }) => {
    const initDocument = async () => {
      await sendRequest('DOM.enable', {})
      const root = await sendRequest('DOM.getDocument', { depth: 1 })
      // TODO
    }

    const restart = method(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initDocument()
    })

    return {
      restart,
    }
  })
  .register()
