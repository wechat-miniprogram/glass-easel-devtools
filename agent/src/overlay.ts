import * as glassEasel from 'glass-easel'

// eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
const wxml = require('./overlay.wxml') as Record<string, unknown>

export const enum OverlayState {
  None = 0,
  NodeSelect,
  Highlight,
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
    selectMoveDetecting: false,
    highlightRect: null as null | { left: number; top: number; width: number; height: number },
  }))
  .init((ctx) => {
    const { self, data, setData, method, listener } = ctx

    // selection
    let nodeSelectUpdateCallback:
      | null
      | ((elem: glassEasel.Element | null, isFinal: boolean) => void) = null
    const startNodeSelect = method(
      (cb: (elem: glassEasel.Element | null, isFinal: boolean) => void) => {
        if (data.state !== OverlayState.None && data.state !== OverlayState.Highlight) {
          return false
        }
        setData({ state: OverlayState.NodeSelect })
        nodeSelectUpdateCallback = cb
        return true
      },
    )
    const endNodeSelect = method(() => {
      if (data.state !== OverlayState.NodeSelect) {
        return false
      }
      setData({ state: OverlayState.None, highlightRect: null })
      nodeSelectUpdateCallback = null
      return true
    })
    const nodeSelectMove = listener<{ clientX: number; clientY: number }>(({ detail }) => {
      if (data.selectMoveDetecting) return
      const x = detail.clientX
      const y = detail.clientY
      const ctx = self.getBackendContext()
      if (!ctx) {
        setData({ highlightRect: null })
        return
      }
      setData({ selectMoveDetecting: true })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      elementFromPointInContext(ctx, x, y)
        .then(async (elem) => {
          setData({ selectMoveDetecting: false })
          if (!elem) {
            setData({ highlightRect: null })
            return undefined
          }
          const { left, top, width, height } = await getBoundingClientRectInContext(elem)
          if (data.state === OverlayState.NodeSelect) {
            setData({ highlightRect: { left, top, width, height } })
          }
          nodeSelectUpdateCallback?.(elem, false)
          return undefined
        })
        .catch(() => {
          setData({ selectMoveDetecting: false, highlightRect: null })
        })
    })
    const nodeSelectDone = listener<{ x: number; y: number }>(({ detail }) => {
      const cb = nodeSelectUpdateCallback
      endNodeSelect()
      const { x, y } = detail
      const ctx = self.getBackendContext()
      if (!ctx) {
        setData({ highlightRect: null })
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      elementFromPointInContext(ctx, x, y).then(async (elem) => {
        // eslint-disable-next-line promise/no-callback-in-promise
        cb?.(elem, true)
        return undefined
      })
    })

    // highlight
    const highlight = method(async (node: glassEasel.Node | null) => {
      if (node && node.asElement()) {
        const elem = node.asElement()!
        const { left, top, width, height } = await getBoundingClientRectInContext(elem)
        if (data.state !== OverlayState.None) {
          return false
        }
        setData({ state: OverlayState.Highlight, highlightRect: { left, top, width, height } })
      } else {
        if (data.state !== OverlayState.Highlight) {
          return false
        }
        setData({ state: OverlayState.None, highlightRect: null })
      }
      return true
    })

    return { startNodeSelect, endNodeSelect, nodeSelectMove, nodeSelectDone, highlight }
  })
  .registerComponent()

const elementFromPointInContext = (
  context: glassEasel.GeneralBackendContext,
  x: number,
  y: number,
) =>
  new Promise<glassEasel.Element | null>((resolve) => {
    if (!context?.elementFromPoint) {
      resolve(null)
      return
    }
    // eslint-disable-next-line
    context.elementFromPoint(x, y, (elem) => {
      resolve(elem)
    })
  })

const getBoundingClientRectInContext = (elem: glassEasel.Element) =>
  new Promise<{ left: number; top: number; width: number; height: number }>((resolve) => {
    elem.getBoundingClientRect((rect) => {
      resolve(rect)
    })
  })

export class OverlayManager {
  private backendContexts: WeakMap<
    glassEasel.GeneralBackendContext,
    glassEasel.Component<any, any, ComponentExport>
  > = new WeakMap()

  get(ctx: glassEasel.GeneralBackendContext): glassEasel.Component<any, any, ComponentExport> {
    const comp = this.backendContexts.get(ctx)
    if (comp) return comp

    // create the component
    const component = space.createComponentByUrl(
      'glass-easel-devtools-agent',
      'glass-easel-devtools-agent',
      null,
      ctx,
    ) as glassEasel.Component<any, any, ComponentExport>
    this.backendContexts.set(ctx, component)

    // insert into backend
    let parentElement: glassEasel.GeneralBackendElement
    let placeholder: glassEasel.GeneralBackendElement
    if (ctx.mode === glassEasel.BackendMode.Composed) {
      parentElement = ctx.getRootNode()
      placeholder = ctx.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
      parentElement.appendChild(placeholder)
    } else if (ctx.mode === glassEasel.BackendMode.Domlike) {
      parentElement = ctx.getRootNode()
      placeholder = ctx.document.createElement('glass-easel-devtools-panel')
      parentElement.appendChild(placeholder)
    } else if (ctx.mode === glassEasel.BackendMode.Shadow) {
      const sr = ctx.getRootNode()
      parentElement = sr
      if (!sr) throw new Error('the host element should be inside of a shadow tree')
      placeholder = sr.createElement('glass-easel-devtools-panel', 'glass-easel-devtools-panel')
      sr.appendChild(placeholder)
    } else {
      throw new Error('unrecognized host backend mode')
    }
    glassEasel.Element.replaceDocumentElement(component, parentElement, placeholder)
    if (
      ctx.mode === glassEasel.BackendMode.Composed ||
      ctx.mode === glassEasel.BackendMode.Shadow
    ) {
      const p = parentElement as glassEasel.composedBackend.Element | glassEasel.backend.Element
      p.release()
      const elem = placeholder as glassEasel.composedBackend.Element | glassEasel.backend.Element
      elem.release()
    }

    return component
  }
}
