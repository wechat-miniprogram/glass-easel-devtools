import { type protocol } from 'glass-easel-devtools-agent'
import { type AgentSendMessageMeta } from '../agent'
import { inFirefox } from '../utils'

declare function cloneInto<T>(x: T, target: Window): T

const prepareDataToAgent = <T>(data: T): T => {
  if (inFirefox()) return cloneInto(data, window)
  return data
}

// avoid double injection
const existingElements = document.querySelectorAll('glass-easel-devtools')
for (let i = 0; i < existingElements.length; i += 1) {
  const hostElement = existingElements[i]
  hostElement.parentNode?.removeChild(hostElement)
}

// create a host node
const hostElement = document.createElement('glass-easel-devtools')
const hostNodeStyle = `
  display: none;
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
`
hostElement.setAttribute('style', hostNodeStyle)
document.documentElement.appendChild(hostElement)

// messaging from background to agent
const postToBackground = (msg: AgentSendMessageMeta) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  chrome.runtime.sendMessage(msg)
}
chrome.runtime.onMessage.addListener((message: protocol.AgentRecvMessage, sender) => {
  if (sender.id !== chrome.runtime.id) return
  const ev = new CustomEvent('glass-easel-devtools-agent-recv', {
    detail: prepareDataToAgent(message),
  })
  hostElement.dispatchEvent(ev)
})

// messaging from agent to background
hostElement.addEventListener('glass-easel-devtools-agent-send', (ev) => {
  const { detail } = ev as CustomEvent<protocol.AgentSendMessage>
  postToBackground(detail)
})
postToBackground({ kind: '_preinit' })
