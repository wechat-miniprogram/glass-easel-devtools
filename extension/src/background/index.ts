/* eslint-disable @typescript-eslint/no-deprecated */

import { type protocol } from 'glass-easel-devtools-agent'
import { type AgentSendMessageMeta } from '../agent'
import type { PanelRecvMessageMeta, PanelSendMessageMeta } from '../panel'
import { ConnectionSource } from '../utils'

// inject a small user script
const USER_SCRIPT_ID = 'glassEaselDevToolsUser'
chrome.scripting
  .registerContentScripts([
    {
      id: USER_SCRIPT_ID,
      world: 'MAIN',
      matches: ['<all_urls>'],
      allFrames: true,
      js: ['dist/stub.js'],
      runAt: 'document_start',
    },
  ])
  .catch(() => {})

// inject main agent when needed
const injectContentScript = (tabId: number) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: false,
    },
    files: ['dist/content.js'],
  })
}
const injectAgentScript = (tabId: number) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  chrome.scripting.executeScript({
    world: 'MAIN',
    target: {
      tabId,
      allFrames: true,
    },
    files: ['dist/agent.js'],
  })
}

// states
const tabMetaMap = Object.create(null) as Record<
  number,
  | {
      content: chrome.runtime.Port | null
      contentPendingMessages: protocol.AgentRecvMessage[]
      devTools: chrome.runtime.Port | null
      pendingMessages: PanelRecvMessageMeta[]
    }
  | undefined
>
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === ConnectionSource.DevToolsPanel) {
    newDevToolsConnection(port)
  } else if (port.name === ConnectionSource.ContentScript) {
    const tabId = port.sender?.tab?.id
    if (!tabId) return
    newContentScriptConnection(tabId, port)
  }
})

// connections from DevTools
const newDevToolsConnection = (port: chrome.runtime.Port) => {
  let tabId = 0
  port.onMessage.addListener((message: PanelSendMessageMeta) => {
    if (message.kind === '_init' || message.kind === '_reconnect') {
      if (tabId && tabMetaMap[tabId]) tabMetaMap[tabId]!.devTools = null
      tabId = message.tabId
      if (tabMetaMap[tabId]) {
        tabMetaMap[tabId]!.contentPendingMessages.length = 0
        tabMetaMap[tabId]!.devTools = port
        const pendingMessages = tabMetaMap[tabId]!.pendingMessages
        tabMetaMap[tabId]!.pendingMessages = []
        pendingMessages.forEach((message) => {
          port.postMessage(message)
        })
        if (message.kind === '_init') injectContentScript(tabId)
      } else {
        tabMetaMap[tabId] = {
          content: null,
          contentPendingMessages: [],
          devTools: port,
          pendingMessages: [],
        }
        injectContentScript(tabId)
      }
    } else if (tabMetaMap[tabId]) {
      const content = tabMetaMap[tabId]!.content
      if (content) content.postMessage(message)
      else tabMetaMap[tabId]!.contentPendingMessages.push(message as protocol.AgentRecvMessage)
    }
  })
  port.onDisconnect.addListener((_port) => {
    if (tabMetaMap[tabId]) tabMetaMap[tabId]!.devTools = null
  })
}

// connections from content script
const newContentScriptConnection = (tabId: number, port: chrome.runtime.Port) => {
  port.onMessage.addListener((message: AgentSendMessageMeta) => {
    const tabMeta = tabMetaMap[tabId]
    if (message.kind === '_preinit') {
      injectAgentScript(tabId)
      return
    }
    let panelMessage: PanelRecvMessageMeta
    if (message.kind === '_init' || message.kind === '_reconnect') {
      panelMessage = { kind: '_connected' }
    } else {
      panelMessage = message as protocol.AgentSendMessage
    }
    if (!tabMeta) {
      tabMetaMap[tabId] = {
        content: port,
        contentPendingMessages: [],
        devTools: null,
        pendingMessages: [panelMessage],
      }
      return
    }
    if (panelMessage.kind === '_connected') {
      tabMeta.content = port
      const messages = tabMeta.contentPendingMessages
      tabMeta.contentPendingMessages = []
      messages.forEach((message) => {
        port.postMessage(message)
      })
    }
    if (!tabMeta.devTools) {
      if (panelMessage.kind === '_connected') tabMeta.pendingMessages.length = 0
      tabMeta.pendingMessages.push(panelMessage)
      return
    }
    tabMeta.devTools.postMessage(panelMessage)
  })
  port.onDisconnect.addListener(() => {
    if (tabMetaMap[tabId]) tabMetaMap[tabId].content = null
  })
}

// inject agent when reloaded
chrome.webNavigation.onDOMContentLoaded.addListener((ev) => {
  const tabId = ev.tabId
  if (ev.frameId !== 0) return
  const tabMeta = tabMetaMap[tabId]
  if (!tabMeta) return
  injectContentScript(tabId)
})

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension started')
