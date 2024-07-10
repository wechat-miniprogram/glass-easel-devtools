import { glassEasel, type Root } from 'glass-easel-miniprogram-adapter'
import { codeSpace, initWithBackend } from '../src' // import the plugin-generated code
import { type MessageChannel, setMessageChannel } from './message_channel'
import { componentDefinition } from './pages/index'
import { warn } from './utils'

export { MessageChannel, PanelRecvMessage, PanelSendMessage } from './message_channel'

let root: Root | null = null

const insertIntoDocumentBody = () => {
  // create the backend context
  const backendContext = new glassEasel.CurrentWindowBackendContext() // or another backend context
  const ab = initWithBackend(backendContext)

  // create a mini-program page
  root = ab.createRoot(
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

export const restart = () => {
  if (!root) {
    warn('cannot restart panel before startup')
    return
  }
  const comp = root.get().asInstanceOf(componentDefinition)
  comp?.restart()
}
