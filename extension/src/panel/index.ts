import { startup, type PanelRecvMessage, type PanelSendMessage } from 'glass-easel-devtools-panel'
import { ConnectionSource } from '../utils'

export type PanelSendMessageMeta = PanelSendMessage | { kind: '_init'; tabId: number }

// build connection to main service
const background = chrome.runtime.connect({
  name: ConnectionSource.DevToolsPanel,
})
const postToBackground = (msg: PanelSendMessageMeta) => {
  background.postMessage(msg)
}
setInterval(() => {
  postToBackground({ kind: '' })
}, 15000)
background.onMessage.addListener((message: PanelRecvMessage) => {
  listener?.(message)
})
postToBackground({ kind: '_init', tabId: chrome.devtools.inspectedWindow.tabId })

// passing massage through channel
let listener: ((data: PanelRecvMessage) => void) | null = null
startup({
  send(data: PanelSendMessage) {
    postToBackground(data)
  },
  recv(f: (data: PanelRecvMessage) => void) {
    listener = f
  },
})

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools panel created')
