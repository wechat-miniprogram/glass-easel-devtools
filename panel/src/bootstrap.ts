import { glassEasel, type Root } from 'glass-easel-miniprogram-adapter'
import { codeSpace, initWithBackend, registerGlobalEventListener } from '../src' // import the plugin-generated code
import { type MessageChannel, setMessageChannel } from './message_channel'
import { componentDefinition } from './pages/index'
import { warn } from './utils'
import { loadGlobalComponents } from './global_components'

export { MessageChannel, PanelRecvMessage, PanelSendMessage } from './message_channel'

let root: Root | null = null

const insertInto = (
  backendContext: glassEasel.GeneralBackendContext,
  backendElement: glassEasel.GeneralBackendElement,
) => {
  // create the backend context
  registerGlobalEventListener(backendContext)
  const ab = initWithBackend(backendContext)

  // add global using components
  loadGlobalComponents(codeSpace)

  // create a mini-program page
  root = ab.createRoot(
    'glass-easel-root', // the tag name of the mount point
    codeSpace,
    'pages/index/index', // the mini-program page to load
  )

  // insert the page into backend
  let placeholder: glassEasel.GeneralBackendElement
  if (backendContext.mode === glassEasel.BackendMode.Composed) {
    const ctx = backendContext
    const parent = backendElement as glassEasel.composedBackend.Element
    placeholder = ctx.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
    parent.appendChild(placeholder)
  } else if (backendContext.mode === glassEasel.BackendMode.Domlike) {
    const ctx = backendContext
    const parent = backendElement as glassEasel.domlikeBackend.Element
    placeholder = ctx.document.createElement('glass-easel-devtools-panel')
    parent.appendChild(placeholder)
  } else if (backendContext.mode === glassEasel.BackendMode.Shadow) {
    const parent = backendElement as glassEasel.backend.Element
    const sr = parent.getShadowRoot()
    if (!sr) throw new Error('the host element should be inside of a shadow tree')
    placeholder = sr.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
    parent.appendChild(placeholder)
  } else {
    throw new Error('unrecognized host backend mode')
  }
  root.attach(
    backendElement as unknown as glassEasel.GeneralBackendElement,
    placeholder as unknown as glassEasel.GeneralBackendElement,
  )
  if (
    backendContext.mode === glassEasel.BackendMode.Composed ||
    backendContext.mode === glassEasel.BackendMode.Shadow
  ) {
    const elem = placeholder as glassEasel.composedBackend.Element | glassEasel.backend.Element
    elem.release()
  }
}

export const startup = (
  hostContext: glassEasel.GeneralBackendContext,
  hostElement: glassEasel.GeneralBackendElement,
  messageChannel: MessageChannel,
) => {
  setMessageChannel(messageChannel)
  insertInto(hostContext, hostElement)
}

export const restart = () => {
  if (!root) {
    warn('cannot restart panel before startup')
    return
  }
  const comp = root.get().asInstanceOf(componentDefinition)
  comp?.restart()
}
