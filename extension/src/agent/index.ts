import { getDevTools, type protocol } from 'glass-easel-devtools-agent'
import { type DevToolsBridge } from '../utils'

export type AgentSendMessageMeta = protocol.AgentSendMessage | { kind: '_init' }

if (window.top !== window) {
  // for iframes, connect to the top frame
  setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if ((window.top as any)?.__glassEaselDevTools__) {
      const userTopGlobal = window.top as unknown as { __glassEaselDevTools__: DevToolsBridge }
      const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
      userGlobal.__glassEaselDevTools__?._devToolsConnect(userTopGlobal.__glassEaselDevTools__)
    }
  }, 0)
} else {
  // receive the host element
  const hostElement = document.querySelector('glass-easel-devtools')
  if (!hostElement) throw new Error('Failed to initialize glass-easel DevTools agent')

  // messaging with content script
  const postMessage = (message: AgentSendMessageMeta) => {
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
  const devTools = getDevTools(messageChannel)

  setTimeout(() => {
    const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
    userGlobal.__glassEaselDevTools__?._devToolsConnect(devTools)
  }, 0)

  // send a message to indicate the agent ready
  postMessage({ kind: '_init' })
}
