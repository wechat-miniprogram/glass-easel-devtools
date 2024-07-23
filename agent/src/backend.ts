/* eslint-disable arrow-body-style */

import * as glassEasel from 'glass-easel'
import { backendUnsupported } from './utils'

export type BoundingClientRect = glassEasel.BoundingClientRect

export const getBoundingClientRect = (
  ctx: glassEasel.GeneralBackendContext,
  elem: glassEasel.GeneralBackendElement,
): Promise<BoundingClientRect> => {
  return new Promise<BoundingClientRect>((resolve) => {
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      const { left, top, width, height } = (
        elem.getBoundingClientRect as () => BoundingClientRect
      )()
      resolve({ left, top, width, height })
    } else if (!elem.getBoundingClientRect) {
      backendUnsupported('Element#getBoundingClientRect')
      resolve({ left: 0, top: 0, width: 0, height: 0 })
    } else {
      elem.getBoundingClientRect((rect) => {
        resolve(rect)
      })
    }
  })
}

export const getAllComputedStyles = (
  ctx: glassEasel.GeneralBackendContext,
  elem: glassEasel.GeneralBackendElement,
): Promise<{ properties: { name: string; value: string }[] }> => {
  return new Promise((resolve) => {
    let properties: { name: string; value: string }[] = []
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      if (typeof ctx.getAllComputedStyles === 'function') {
        ctx.getAllComputedStyles(elem as glassEasel.domlikeBackend.Element, (ret) => {
          properties = ret.properties
          resolve({ properties })
        })
      } else {
        backendUnsupported('Context#getAllComputedStyles')
      }
    } else {
      if ('getAllComputedStyles' in elem) {
        ;(elem as glassEasel.backend.Element).getAllComputedStyles!((ret) => {
          properties = ret.properties
          resolve({ properties })
        })
      } else {
        backendUnsupported('Element#getAllComputedStyles')
      }
    }
  })
}

export const getBoxModel = (
  ctx: glassEasel.GeneralBackendContext,
  elem: glassEasel.GeneralBackendElement,
): Promise<{
  margin: BoundingClientRect
  border: BoundingClientRect
  padding: BoundingClientRect
  content: BoundingClientRect
}> => {
  const parsePx = (v: string): number => {
    if (!v.endsWith('px')) return NaN
    return Number(v.slice(0, -2))
  }
  return new Promise<{
    margin: BoundingClientRect
    border: BoundingClientRect
    padding: BoundingClientRect
    content: BoundingClientRect
  }>((resolve) => {
    if ('getBoxModel' in elem) {
      // if there is `getBoxModel` call, use it
      elem.getBoxModel!((ret) => {
        resolve(ret)
      })
    } else {
      // otherwise, use `getAllComputedStyles` to emulate
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return, promise/always-return
      Promise.resolve().then(async () => {
        const border = await getBoundingClientRect(ctx, elem)
        const cs = await getAllComputedStyles(ctx, elem)
        let marginLeft = NaN
        let marginTop = NaN
        let marginRight = NaN
        let marginBottom = NaN
        let paddingLeft = NaN
        let paddingTop = NaN
        let paddingRight = NaN
        let paddingBottom = NaN
        let borderLeft = NaN
        let borderTop = NaN
        let borderRight = NaN
        let borderBottom = NaN
        cs.properties.forEach(({ name, value }) => {
          if (name === 'margin-left') marginLeft = parsePx(value)
          if (name === 'margin-top') marginTop = parsePx(value)
          if (name === 'margin-right') marginRight = parsePx(value)
          if (name === 'margin-bottom') marginBottom = parsePx(value)
          if (name === 'padding-left') paddingLeft = parsePx(value)
          if (name === 'padding-top') paddingTop = parsePx(value)
          if (name === 'padding-right') paddingRight = parsePx(value)
          if (name === 'padding-bottom') paddingBottom = parsePx(value)
          if (name === 'border-left-width') borderLeft = parsePx(value)
          if (name === 'border-top-width') borderTop = parsePx(value)
          if (name === 'border-right-width') borderRight = parsePx(value)
          if (name === 'border-bottom-width') borderBottom = parsePx(value)
        })
        const margin = {
          left: border.left - marginLeft,
          top: border.top - marginTop,
          width: border.width + marginLeft + marginRight,
          height: border.height + marginTop + marginBottom,
        }
        const padding = {
          left: border.left + borderLeft,
          top: border.top + borderTop,
          width: border.width - borderLeft - borderRight,
          height: border.height - borderTop - borderBottom,
        }
        const content = {
          left: padding.left + paddingLeft,
          top: padding.top + paddingTop,
          width: padding.width - paddingLeft - paddingRight,
          height: padding.height - paddingTop - paddingBottom,
        }
        resolve({
          margin,
          border,
          padding,
          content,
        })
      })
    }
  })
}

export const getMatchedRules = (
  ctx: glassEasel.GeneralBackendContext,
  elem: glassEasel.GeneralBackendElement,
): Promise<{
  inline: glassEasel.CSSProperty[]
  inlineText?: string
  rules: glassEasel.CSSRule[]
}> => {
  return new Promise((resolve) => {
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      if (typeof ctx.getMatchedRules === 'function') {
        ctx.getMatchedRules(elem as glassEasel.domlikeBackend.Element, (ret) => {
          resolve(ret)
        })
      } else {
        backendUnsupported('Context#getMatchedRules')
      }
    } else {
      if ('getMatchedRules' in elem) {
        ;(elem as glassEasel.backend.Element).getMatchedRules!((ret) => {
          resolve(ret)
        })
      } else {
        backendUnsupported('Element#getMatchedRules')
      }
    }
  })
}
