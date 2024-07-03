import { sendRequest } from "../../message_channel"

Component()
  .data(() => ({}))
  .init(({ data, setData, lifetime }) => {
    const initDocument = async () => {
      await sendRequest('DOM.enable', {})
      const root = await sendRequest('DOM.getDocument', { depth: 1 })
      // TODO
    }
    lifetime('attached', () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initDocument()
    })
  })
  .register()
