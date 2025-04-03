import { type AgentSendMessageMeta } from '../agent'
import { type PanelSendMessageMeta } from '../panel'
import { ConnectionSource } from '../utils'

// inject a small user script
// eslint-disable-next-line @typescript-eslint/no-floating-promises
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
  {
    devTools?: chrome.runtime.Port
    pendingMessages: AgentSendMessageMeta[]
  }
>
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === ConnectionSource.DevToolsPanel) {
    newDevToolsConnection(port)
  }
})

// connections from DevTools
const newDevToolsConnection = (port: chrome.runtime.Port) => {
  let tabId = 0
  port.onMessage.addListener((message: PanelSendMessageMeta) => {
    if (message.kind === '_init' || message.kind === '_reconnect') {
      if (tabId) delete tabMetaMap[tabId]
      tabId = message.tabId
      if (tabMetaMap[tabId]) {
        tabMetaMap[tabId].devTools = port
        const pendingMessages = tabMetaMap[tabId].pendingMessages
        tabMetaMap[tabId].pendingMessages = []
        pendingMessages.forEach((message) => {
          port.postMessage(message)
        })
      } else {
        tabMetaMap[tabId] = { devTools: port, pendingMessages: [] }
      }
      if (message.kind === '_init') injectContentScript(tabId)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      chrome.tabs.sendMessage(tabId, message)
    }
  })
  port.onDisconnect.addListener((_port) => {
    if (tabId) delete tabMetaMap[tabId]
  })
}

// connections from content script
chrome.runtime.onMessage.addListener((message: AgentSendMessageMeta, sender) => {
  if (sender.id !== chrome.runtime.id) return
  const tabId = sender.tab?.id
  if (!tabId) return
  const tabMeta = tabMetaMap[tabId]
  if (!tabMeta) {
    tabMetaMap[tabId] = { pendingMessages: [message] }
    return
  }
  if (!tabMeta.devTools) {
    tabMeta.pendingMessages.push(message)
    return
  }
  if (message.kind === '_preinit') {
    injectAgentScript(tabId)
  } else if (message.kind === '_init') {
    tabMeta.devTools.postMessage({ kind: '_connected' })
  } else {
    tabMeta.devTools.postMessage(message)
  }
})

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
