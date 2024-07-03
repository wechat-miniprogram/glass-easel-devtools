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
const sendHeartbeat = () => {
  setTimeout(() => {
    postToBackground({ kind: '' })
    sendHeartbeat()
  }, 15000)
}
sendHeartbeat()
background.onMessage.addListener((message: PanelRecvMessage) => {
  listener?.(message)
})
postToBackground({ kind: '_init', tabId: chrome.devtools.inspectedWindow.tabId })

// passing massage through channel
let listener: ((data: PanelRecvMessage) => void) | null = null
setTimeout(() => {
  startup({
    send(data: PanelSendMessage) {
      postToBackground(data)
    },
    recv(f: (data: PanelRecvMessage) => void) {
      listener = f
    },
  })
}, 0)

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools panel created')
