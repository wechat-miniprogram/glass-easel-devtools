import { ConnectionSource } from '../utils'
import { type PanelSendMessage } from './message'

// build connection to main service
const background = chrome.runtime.connect({
  name: ConnectionSource.DevToolsPanel,
})
const postToBackground = (msg: PanelSendMessage) => {
  background.postMessage(msg)
}
setInterval(() => {
  postToBackground({ type: '' })
}, 15000)
postToBackground({ type: 'inspect', tabId: chrome.devtools.inspectedWindow.tabId })

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools panel created')
