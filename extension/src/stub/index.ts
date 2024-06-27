/* eslint-disable class-methods-use-this */

import { type DevTools, type DevToolsBridge, type InspectorDevTools } from '../utils'

let devToolsTarget: DevTools | null = null
const mountPoints = new Set()

class Inspector implements InspectorDevTools {
  addMountPoint(elem: unknown) {
    mountPoints.add(elem)
    if (devToolsTarget) devToolsTarget.inspector?.addMountPoint(elem)
  }

  removeMountPoint(elem: unknown) {
    mountPoints.delete(elem)
    if (devToolsTarget) devToolsTarget.inspector?.removeMountPoint(elem)
  }
}

const glassEaselDevTools = {
  inspector: new Inspector(),
  _devToolsConnect(target: DevTools) {
    devToolsTarget = target
    mountPoints.forEach((elem) => target.inspector?.addMountPoint(elem))
  },
  _devToolsDisconnect() {
    devToolsTarget = null
  },
}

const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
if (userGlobal.__glassEaselDevTools__ === undefined) {
  userGlobal.__glassEaselDevTools__ = glassEaselDevTools
}
