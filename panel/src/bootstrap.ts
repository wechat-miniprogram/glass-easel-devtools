import * as glassEasel from 'glass-easel'
import { codeSpace, initWithBackend } from '../src' // import the plugin-generated code
import { type MessageChannel, setMessageChannel } from './message_channel'

export { MessageChannel, PanelRecvMessage, PanelSendMessage } from './message_channel'

const insertIntoDocumentBody = () => {
  // create the backend context
  const backendContext = new glassEasel.CurrentWindowBackendContext() // or another backend context
  const ab = initWithBackend(backendContext)

  // create a mini-program page
  const root = ab.createRoot(
    'glass-easel-root', // the tag name of the mount point
    codeSpace,
    'pages/index/index', // the mini-program page to load
  )

  // insert the page into backend
  // (this step is backend-related - if the backend is not DOM, refer to the backend documentation)
  const placeholder = document.createElement('span')
  document.body.appendChild(placeholder)
  root.attach(
    document.body as unknown as glassEasel.GeneralBackendElement,
    placeholder as unknown as glassEasel.GeneralBackendElement,
  )
}

export const startup = (messageChannel: MessageChannel) => {
  setMessageChannel(messageChannel)
  insertIntoDocumentBody()
}
