import * as glassEasel from 'glass-easel'
import type * as agent from 'glass-easel-devtools-agent'
import * as panel from 'glass-easel-devtools-panel'

// the message channel
const agentEnd = {
  _f: null as null | ((data: agent.protocol.AgentRecvMessage) => void),
  send(data: agent.protocol.AgentSendMessage) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
    Promise.resolve().then(() => {
      panelEnd._f?.(data)
      return undefined
    })
  },
  recv(listener: (data: agent.protocol.AgentRecvMessage) => void) {
    this._f = listener
  },
}
const panelEnd = {
  _f: null as null | ((data: agent.protocol.AgentSendMessage) => void),
  send(data: agent.protocol.AgentRecvMessage) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
    Promise.resolve().then(() => {
      agentEnd._f?.(data)
      return undefined
    })
  },
  recv(listener: (data: agent.protocol.AgentSendMessage) => void) {
    this._f = listener
  },
}

// init iframe
const iframe = document.createElement('iframe')
// eslint-disable-next-line no-script-url
iframe.src = 'stub.html'
iframe.style.border = 'none'
iframe.style.flex = '1'
iframe.onload = () => {
  const iframeWindow = iframe.contentWindow!
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  ;(iframeWindow as any).__agentEnd = agentEnd
  const agentTag = iframeWindow.document.createElement('script')
  agentTag.src = 'dist/agent.js'
  iframeWindow.document.body.appendChild(agentTag)
  iframeWindow.history.replaceState(null, '', '../miniprogram/dist/index.html')
  const onAgentReady = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (typeof (iframeWindow as any).__glassEaselDevTools__ !== 'undefined') {
      const styleTag = iframeWindow.document.createElement('link')
      styleTag.setAttribute('rel', 'stylesheet')
      styleTag.setAttribute('href', 'index.css')
      iframeWindow.document.head.appendChild(styleTag)
      const scriptTag = iframeWindow.document.createElement('script')
      scriptTag.src = 'index.js'
      iframeWindow.document.body.appendChild(scriptTag)
      panel.restart()
    } else {
      setTimeout(onAgentReady, 50)
    }
  }
  onAgentReady()
}
document.body.appendChild(iframe)

// init panel
const hostContext = new glassEasel.CurrentWindowBackendContext()
const panelElement = document.createElement('glass-easel-devtools-panel')
const panelNodeStyle = `
  flex: none;
  width: 700px;
  border-left: 2px solid #808080;
  box-sizing: border-box;
`
panelElement.setAttribute('style', panelNodeStyle)
document.body.appendChild(panelElement)
panel.startup(hostContext, panelElement as any, panelEnd)
