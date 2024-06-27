import { type AgentSendMessage } from '../agent/message'
import { ConnectionSource } from '../utils'

const background = chrome.runtime.connect({
  name: ConnectionSource.ContentScript,
})
const postToBackground = (msg: AgentSendMessage) => {
  background.postMessage(msg)
}
setInterval(() => {
  postToBackground({ type: '' })
}, 15000)

window.addEventListener('glass-easel-devtools', (ev: unknown) => {
  const { detail } = ev as CustomEvent<AgentSendMessage>
  postToBackground(detail)
})
