import { type protocol } from 'glass-easel-devtools-agent'
import { ConnectionSource, inFirefox } from '../utils'

declare function cloneInto<T>(x: T, target: Window): T

const prepareDataToAgent = <T>(data: T): T => {
  if (inFirefox()) return cloneInto(data, window)
  return data
}

// avoid double injection
const hostElement = document.querySelector('glass-easel-devtools')
if (hostElement) {
  // empty
} else {
  // create a host node
  const hostElement = document.createElement('glass-easel-devtools')
  const hostNodeStyle = `
    display: block;
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
  `
  hostElement.setAttribute('style', hostNodeStyle)
  document.documentElement.appendChild(hostElement)

  // messaging from background to agent
  const background = chrome.runtime.connect({
    name: ConnectionSource.ContentScript,
  })
  setInterval(() => {
    background.postMessage({ kind: '' })
  }, 15000)
  background.onMessage.addListener((message: protocol.AgentRecvMessage) => {
    const ev = new CustomEvent('glass-easel-devtools-agent-recv', {
      detail: prepareDataToAgent(message),
    })
    hostElement.dispatchEvent(ev)
  })

  // messaging from agent to background
  hostElement.addEventListener('glass-easel-devtools-agent-send', (ev) => {
    const { detail } = ev as CustomEvent<protocol.AgentSendMessage>
    background.postMessage(detail)
  })
}
