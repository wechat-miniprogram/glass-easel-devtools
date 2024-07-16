import * as glassEasel from 'glass-easel'
import { type Connection } from '.'

// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const wxml = require('./overlay.wxml') as Record<string, unknown>

export const enum OverlayState {
  None = 0,
  NodeSelect,
}

const space = new glassEasel.ComponentSpace()

type ComponentExport = {
  startNodeSelect(): void
  endNodeSelect(): void
}

export const overlayCompDef = space
  .define('glass-easel-devtools-agent')
  .template(wxml)
  .data(() => ({
    state: OverlayState.None,
  }))
  .init(({ data, method }) => {
    const startNodeSelect = method(() => {
      if (data.state !== OverlayState.None) {
        return false
      }
      data.state = OverlayState.NodeSelect
      // TODO
      return true
    })

    const endNodeSelect = method(() => {
      if (data.state !== OverlayState.NodeSelect) {
        return false
      }
      data.state = OverlayState.None
      return true
    })

    return { startNodeSelect, endNodeSelect }
  })
  .registerComponent()

export class OverlayManager {
  private conn: Connection
  readonly component: glassEasel.Component<any, any, ComponentExport>

  constructor(conn: Connection) {
    this.conn = conn
    const backendContext = this.conn.hostContext
    const backendElement = this.conn.hostElement

    // create the component
    this.component = space.createComponentByUrl(
      'glass-easel-devtools-agent',
      'glass-easel-devtools-agent',
      null,
      backendContext,
    ) as glassEasel.Component<any, any, ComponentExport>
    let placeholder: glassEasel.GeneralBackendElement

    // insert into backend
    if (backendContext.mode === glassEasel.BackendMode.Composed) {
      const ctx = backendContext
      const parent = backendElement as glassEasel.composedBackend.Element
      placeholder = ctx.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
      parent.appendChild(placeholder)
    } else if (backendContext.mode === glassEasel.BackendMode.Domlike) {
      const ctx = backendContext
      const parent = backendElement as glassEasel.domlikeBackend.Element
      placeholder = ctx.document.createElement('glass-easel-devtools-panel')
      parent.appendChild(placeholder)
    } else if (backendContext.mode === glassEasel.BackendMode.Shadow) {
      const parent = backendElement as glassEasel.backend.Element
      const sr = parent.getShadowRoot()
      if (!sr) throw new Error('the host element should be inside of a shadow tree')
      placeholder = sr.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
      parent.appendChild(placeholder)
    } else {
      throw new Error('unrecognized host backend mode')
    }
    glassEasel.Element.replaceDocumentElement(this.component, backendElement, placeholder)
    if (
      backendContext.mode === glassEasel.BackendMode.Composed ||
      backendContext.mode === glassEasel.BackendMode.Shadow
    ) {
      const elem = placeholder as glassEasel.composedBackend.Element | glassEasel.backend.Element
      elem.release()
    }
  }
}
