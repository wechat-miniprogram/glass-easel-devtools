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
iframe.src = 'javascript:false'
iframe.style.border = 'none'
iframe.style.flex = '1'
document.body.appendChild(iframe)
const iframeWindow = iframe.contentWindow!
Reflect.set(iframeWindow, '__agentEnd', agentEnd)
iframeWindow.document.open()
iframeWindow.document.write(`<!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
    </head>
    <body>
      <!-- the entry component will be loaded here -->
    </body>
    <script src="dist/agent.js"></script>
  </html>
`)
iframeWindow.document.close()
setTimeout(() => {
  iframeWindow.history.replaceState(null, '', '../miniprogram/dist/index.html')
  const styleTag = iframeWindow.document.createElement('link')
  styleTag.setAttribute('rel', 'stylesheet')
  styleTag.setAttribute('href', 'index.css')
  iframeWindow.document.head.appendChild(styleTag)
  const scriptTag = iframeWindow.document.createElement('script')
  scriptTag.src = 'index.js'
  iframeWindow.document.body.appendChild(scriptTag)
  setTimeout(() => {
    panel.restart()
  }, 100)
}, 0)

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
