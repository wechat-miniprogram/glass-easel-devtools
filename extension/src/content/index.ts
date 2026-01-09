/* eslint-disable @typescript-eslint/no-deprecated */

import { type protocol } from 'glass-easel-devtools-agent'
import { type AgentSendMessageMeta } from '../agent'
import { ConnectionSource, inFirefox } from '../utils'

declare function cloneInto<T>(x: T, target: Window): T

const prepareDataToAgent = <T>(data: T): T => {
  if (inFirefox()) return cloneInto(data, window)
  return data
}

// avoid double injection
const existingElement = document.querySelector('glass-easel-devtools')
if (existingElement) {
  const ev = new CustomEvent('glass-easel-devtools-reconnect', {})
  existingElement.dispatchEvent(ev)
} else {
  const hostElement = document.createElement('glass-easel-devtools')
  hostElement.addEventListener('glass-easel-devtools-reconnect', () => {
    reconnect()
  })

  // host node styles
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
  let background = chrome.runtime.connect({
    name: ConnectionSource.ContentScript,
  })
  const postToBackground = (msg: AgentSendMessageMeta) => {
    try {
      background.postMessage(msg)
    } catch {
      reconnect()
      background.postMessage(msg)
    }
  }
  const bindListener = () => {
    background.onMessage.addListener((message: unknown) => {
      const ev = new CustomEvent('glass-easel-devtools-agent-recv', {
        detail: prepareDataToAgent(message),
      })
      hostElement.dispatchEvent(ev)
    })
  }
  const reconnect = () => {
    background = chrome.runtime.connect({
      name: ConnectionSource.ContentScript,
    })
    bindListener()
    postToBackground({ kind: '_reconnect' })
  }
  bindListener()
  background.onDisconnect.addListener(reconnect)

  // messaging from agent to background
  hostElement.addEventListener('glass-easel-devtools-agent-send', (ev) => {
    const { detail } = ev as CustomEvent<protocol.AgentSendMessage>
    postToBackground(detail)
  })
  postToBackground({ kind: '_preinit' })
}
