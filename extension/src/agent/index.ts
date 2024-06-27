import { type DevTools, type DevToolsBridge, type InspectorDevTools } from '../utils'
import { type AgentSendMessage } from './message'

// messaging
const postMessage = (message: AgentSendMessage) => {
  const ev = new CustomEvent('glass-easel-devtools', { detail: message })
  window.dispatchEvent(ev)
}

class InspectorDevToolsImpl implements InspectorDevTools {
  // eslint-disable-next-line class-methods-use-this
  addMountPoint(root: unknown): void {
    console.info('!!! add root', root) // TODO
    postMessage({ type: '' })
  }

  // eslint-disable-next-line class-methods-use-this
  removeMountPoint(root: unknown): void {
    console.info('!!! remove root', root) // TODO
  }
}

const devToolsImpl: DevTools = {
  inspector: new InspectorDevToolsImpl(),
}

const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
userGlobal.__glassEaselDevTools__?._devToolsConnect(devToolsImpl)
