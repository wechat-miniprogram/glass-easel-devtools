/* eslint-disable arrow-body-style */

import * as glassEasel from 'glass-easel'
import { backendUnsupported } from './utils'

export type BoundingClientRect = { left: number; top: number; width: number; height: number }

declare function getComputedStyle(elem: glassEasel.domlikeBackend.Element): {
  length: number
  item(index: number): string
  getPropertyValue(name: string): string
}

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
      if (typeof getComputedStyle === 'function') {
        const cs = getComputedStyle(elem as glassEasel.domlikeBackend.Element)
        const length = cs.length
        for (let i = 0; i < length; i += 1) {
          const name = cs.item(i)
          const value = cs.getPropertyValue(name)
          properties.push({ name, value })
        }
      } else {
        backendUnsupported('Window#getComputedStyle')
      }
    } else {
      if ('getAllComputedStyles' in elem) {
        ;(elem as glassEasel.backend.Element).getAllComputedStyles?.((ret) => {
          properties = ret.properties
        })
      } else {
        backendUnsupported('Element#getAllComputedStyles')
      }
    }
    resolve({ properties })
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
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      // for DOM backend, use a combination of bounding client rect and computed style
      const border = (elem as glassEasel.domlikeBackend.Element).getBoundingClientRect!()
      const cs = getComputedStyle(elem as glassEasel.domlikeBackend.Element)
      const marginLeft = parsePx(cs.getPropertyValue('margin-left'))
      const marginTop = parsePx(cs.getPropertyValue('margin-top'))
      const marginRight = parsePx(cs.getPropertyValue('margin-right'))
      const marginBottom = parsePx(cs.getPropertyValue('margin-bottom'))
      const paddingLeft = parsePx(cs.getPropertyValue('padding-left'))
      const paddingTop = parsePx(cs.getPropertyValue('padding-top'))
      const paddingRight = parsePx(cs.getPropertyValue('padding-right'))
      const paddingBottom = parsePx(cs.getPropertyValue('padding-bottom'))
      const borderLeft = parsePx(cs.getPropertyValue('border-left-width'))
      const borderTop = parsePx(cs.getPropertyValue('border-top-width'))
      const borderRight = parsePx(cs.getPropertyValue('border-right-width'))
      const borderBottom = parsePx(cs.getPropertyValue('border-bottom-width'))
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
    } else if ('getBoxModel' in elem) {
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
