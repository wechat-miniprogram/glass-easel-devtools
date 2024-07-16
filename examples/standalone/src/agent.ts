import * as glassEasel from 'glass-easel'
import * as agent from 'glass-easel-devtools-agent'

// init agent
const hostContext = new glassEasel.CurrentWindowBackendContext()
const hostElement = document.createElement('glass-easel-devtools')
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
const devTools = agent.getDevTools(hostContext, hostElement as any, Reflect.get(window, '__agentEnd'))
Reflect.set(window, '__glassEaselDevTools__', devTools)
