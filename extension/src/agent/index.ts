import { CurrentWindowBackendContext, type GeneralBackendElement } from 'glass-easel'
import { getDevTools, type protocol } from 'glass-easel-devtools-agent'
import { type DevToolsBridge } from '../utils'

// receive the host element
const hostElement = document.querySelector('glass-easel-devtools')
if (!hostElement) throw new Error('Failed to initialize glass-easel DevTools agent')
const hostContext = new CurrentWindowBackendContext()

// messaging with content script
const postMessage = (message: protocol.AgentSendMessage) => {
  const ev = new CustomEvent('glass-easel-devtools-agent-send', { detail: message })
  hostElement.dispatchEvent(ev)
}
hostElement.addEventListener('glass-easel-devtools-agent-recv', (ev) => {
  const { detail } = ev as CustomEvent<protocol.AgentRecvMessage>
  requestListener?.(detail)
})

// create the real agent
let requestListener: ((data: protocol.AgentRecvMessage) => void) | null = null
const messageChannel = {
  send(data: protocol.AgentSendMessage) {
    postMessage(data)
  },
  recv(listener: (data: protocol.AgentRecvMessage) => void) {
    requestListener = listener
  },
}
const devTools = getDevTools(
  hostContext,
  hostElement as unknown as GeneralBackendElement,
  messageChannel,
)

const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
userGlobal.__glassEaselDevTools__?._devToolsConnect(devTools)
