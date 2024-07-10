import { type AgentSendMessageMeta } from '../agent'
import { type PanelSendMessageMeta } from '../panel'
import { ConnectionSource } from '../utils'

// inject a small user script
// eslint-disable-next-line @typescript-eslint/no-floating-promises
chrome.scripting.registerContentScripts([
  {
    id: 'glassEaselDevToolsUser',
    world: 'MAIN',
    matches: ['<all_urls>'],
    allFrames: true,
    js: ['dist/stub.js'],
    runAt: 'document_start',
  },
])

// inject main agent when needed
const injectContentScript = (tabId: number) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  chrome.scripting.executeScript({
    target: {
      tabId,
      allFrames: true,
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
    devTools: chrome.runtime.Port
    contentScript?: chrome.runtime.Port
  }
>
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === ConnectionSource.DevToolsPanel) {
    newDevToolsConnection(port)
  } else if (port.name === ConnectionSource.ContentScript) {
    newContentScriptConnection(port)
  }
})

// connections from DevTools
const newDevToolsConnection = (port: chrome.runtime.Port) => {
  let tabId = 0
  port.onMessage.addListener((message: PanelSendMessageMeta) => {
    if (message.kind === '_init') {
      if (tabId) delete tabMetaMap[tabId]
      tabId = message.tabId
      tabMetaMap[tabId] = { devTools: port }
      injectContentScript(tabId)
    } else if (message.kind !== '') {
      const tabMeta = tabMetaMap[tabId]
      if (!tabMeta) return
      if (tabMeta.contentScript) {
        tabMeta.contentScript.postMessage(message)
      } else {
        // eslint-disable-next-line no-console
        console.warn('Failed to send message to agent since the agent is not connected')
      }
    }
  })
  port.onDisconnect.addListener((_port) => {
    if (tabId) delete tabMetaMap[tabId]
  })
}

// connections from content script
const newContentScriptConnection = (port: chrome.runtime.Port) => {
  const tabId = port.sender?.tab?.id
  if (tabId === undefined) return
  const tabMeta = tabMetaMap[tabId]
  if (!tabMeta) return
  port.onMessage.addListener((message: AgentSendMessageMeta) => {
    const tabMeta = tabMetaMap[tabId]
    if (!tabMeta) return
    if (message.kind === '_init') {
      tabMeta.contentScript = port
      tabMeta.devTools.postMessage({ kind: '_connected' })
    } else {
      tabMeta.devTools.postMessage(message)
    }
  })
  port.onDisconnect.addListener((_port) => {
    const tabMeta = tabMetaMap[tabId]
    if (!tabMeta) return
    tabMeta.contentScript = undefined
  })
  injectAgentScript(tabId)
}

// inject agent when reloaded
chrome.webNavigation.onDOMContentLoaded.addListener((ev) => {
  const tabId = ev.tabId
  const tabMeta = tabMetaMap[tabId]
  if (!tabMeta) return
  injectContentScript(tabId)
})

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension started')
