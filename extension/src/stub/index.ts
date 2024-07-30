/* eslint-disable class-methods-use-this */

import type * as glassEasel from 'glass-easel'
import { type DevTools, type DevToolsBridge, type InspectorDevTools } from '../utils'

let devToolsTarget: DevTools | null = null
const mountPoints = new Map<glassEasel.Element, glassEasel.MountPointEnv>()

class Inspector implements InspectorDevTools {
  addMountPoint(elem: glassEasel.Element, env: glassEasel.MountPointEnv) {
    mountPoints.set(elem, env)
    if (devToolsTarget) devToolsTarget.inspector?.addMountPoint(elem, env)
  }

  removeMountPoint(elem: glassEasel.Element) {
    mountPoints.delete(elem)
    if (devToolsTarget) devToolsTarget.inspector?.removeMountPoint(elem)
  }
}

const glassEaselDevTools = {
  inspector: new Inspector(),
  _devToolsConnect(target: DevTools) {
    if (devToolsTarget) {
      this._devToolsDisconnect()
    }
    devToolsTarget = target
    mountPoints.forEach((env, elem) => target.inspector?.addMountPoint(elem, env))
  },
  _devToolsDisconnect() {
    if (!devToolsTarget) return
    const target = devToolsTarget
    devToolsTarget = null
    mountPoints.forEach((_, elem) => target.inspector?.removeMountPoint(elem))
  },
}

const userGlobal = window as unknown as { __glassEaselDevTools__?: DevToolsBridge }
if (userGlobal.__glassEaselDevTools__ === undefined) {
  userGlobal.__glassEaselDevTools__ = glassEaselDevTools
}
