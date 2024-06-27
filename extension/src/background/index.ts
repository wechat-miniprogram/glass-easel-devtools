import { type AgentSendMessage } from '../agent/message'
import { type PanelSendMessage } from '../panel/message'
import { ConnectionSource } from '../utils'

// inject a small user script
// eslint-disable-next-line @typescript-eslint/no-floating-promises
chrome.scripting.registerContentScripts([
  {
    id: 'user',
    world: 'MAIN',
    matches: ['<all_urls>'],
    allFrames: true,
    js: ['dist/stub.js'],
    runAt: 'document_start',
  },
])

// inject main agent when needed
const injectAgentScript = (tabId: number) => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
  chrome.scripting
    .executeScript({
      target: {
        tabId,
        allFrames: true,
      },
      files: ['dist/content.js'],
    })
    .then(() =>
      chrome.scripting.executeScript({
        world: 'MAIN',
        target: {
          tabId,
          allFrames: true,
        },
        files: ['dist/agent.js'],
      }),
    )
}

// states
const tabPortMap = Object.create(null) as Record<number, chrome.runtime.Port>

// connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === ConnectionSource.DevToolsPanel) {
    // connections from DevTools
    let tabId = 0
    port.onMessage.addListener((message: PanelSendMessage) => {
      if (message.type === 'inspect') {
        if (tabId) delete tabPortMap[tabId]
        tabId = message.tabId
        tabPortMap[tabId] = port
        injectAgentScript(tabId)
      }
    })
    port.onDisconnect.addListener((_port) => {
      if (tabId) delete tabPortMap[tabId]
    })
  } else if (port.name === ConnectionSource.ContentScript) {
    // connections from content-script
    port.onMessage.addListener((message: AgentSendMessage) => {
      console.info('!!! agent send', message) // TODO
    })
  }
})

// inject agent when reloaded
chrome.webNavigation.onCommitted.addListener((ev) => {
  const tabId = ev.tabId
  const port = tabPortMap[tabId]
  if (!port) return
  injectAgentScript(tabId)
})

// eslint-disable-next-line no-console
console.log('glass-easel DevTools extension started')
