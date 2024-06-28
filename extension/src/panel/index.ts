import { protocol } from 'glass-easel-devtools-agent'
import { ConnectionSource } from '../utils'
import { type PanelRecvMessage, type PanelSendMessage } from './message'

// build connection to main service
const background = chrome.runtime.connect({
  name: ConnectionSource.DevToolsPanel,
})
const postToBackground = (msg: PanelSendMessage) => {
  background.postMessage(msg)
}
setInterval(() => {
  postToBackground({ kind: '' })
}, 15000)
background.onMessage.addListener((message: PanelRecvMessage) => {
  if (message.kind !== '') {
    // FIXME test code
    console.info('!!! panel recv', message)
    // sendRequest('getBoundingClientRect', { nodeId: Date.now() })
  }
})
postToBackground({ kind: '_init', tabId: chrome.devtools.inspectedWindow.tabId })

// request sender
let requestIdInc = 1
const sendRequest = <T extends keyof protocol.AgentRequestKind>(name: T, detail: protocol.AgentRequestKind[T]['request']) => {
  const id = requestIdInc
  requestIdInc += 1
  postToBackground({ kind: 'request', id, name, detail })
}

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools panel created')
