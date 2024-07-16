import * as glassEasel from 'glass-easel'
import {
  startup,
  restart,
  type PanelRecvMessage,
  type PanelSendMessage,
} from 'glass-easel-devtools-panel'
import { ConnectionSource } from '../utils'

export type PanelSendMessageMeta = PanelSendMessage | { kind: '_init'; tabId: number }
export type PanelRecvMessageMeta = PanelRecvMessage | { kind: '_connected' }

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
background.onMessage.addListener((message: PanelRecvMessageMeta) => {
  if (message.kind === '_connected') {
    restart()
  } else {
    listener?.(message)
  }
})
postToBackground({ kind: '_init', tabId: chrome.devtools.inspectedWindow.tabId })

// passing massage through channel
let listener: ((data: PanelRecvMessage) => void) | null = null
setTimeout(() => {
  const hostContext = new glassEasel.CurrentWindowBackendContext()
  const hostElement = document.body as unknown as glassEasel.GeneralBackendElement
  const channel = {
    send(data: PanelSendMessage) {
      postToBackground(data)
    },
    recv(f: (data: PanelRecvMessage) => void) {
      listener = f
    },
  }
  startup(hostContext, hostElement, channel)
}, 0)

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension DevTools panel created')
