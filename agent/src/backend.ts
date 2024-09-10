/* eslint-disable arrow-body-style */

import * as glassEasel from 'glass-easel'
import parser from 'postcss-selector-parser'
import { selectorSpecificity, compare as selectorCompare } from '@csstools/selector-specificity'
import {
  tokenize,
  TokenType,
  stringify,
  type CSSToken,
  type TokenString,
} from '@csstools/css-tokenizer'
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

const expectToken = (
  token: CSSToken | undefined,
  type: TokenType,
  name?: string,
): string | null => {
  if (token === undefined) return null
  if (token[0] !== type) return null
  if (name === undefined) return token[1]
  if (name === token[1]) return name
  return null
}

const parseNameValueStr = (cssText: string) => {
  const ret: { name: string; value: string }[] = []
  const tokens = tokenize({ css: cssText })
  if (tokens.length === 0) return null
  let nameStart = 0
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i]
    if (expectToken(t, TokenType.Colon)) {
      const name = stringify(...tokens.slice(nameStart, i)).trim()
      i += 1
      const valueStart = i
      for (; i < tokens.length; i += 1) {
        const t = tokens[i]
        if (expectToken(t, TokenType.Semicolon)) break
      }
      const value = stringify(...tokens.slice(valueStart, i)).trim()
      ret.push({ name, value })
      nameStart = i + 1
    }
  }
  return ret
}

export const getMatchedRules = (
  element: glassEasel.Element,
): Promise<{
  inline: glassEasel.CSSProperty[]
  inlineText?: string
  rules: glassEasel.CSSRule[]
  crossOriginFailing?: boolean
}> => {
  const convertAdapterGeneratedRules = (rules: glassEasel.CSSRule[]) => {
    rules.forEach((rule) => {
      const tokens = tokenize({ css: rule.selector })
      if (
        expectToken(tokens[0], TokenType.OpenSquare) &&
        expectToken(tokens[1], TokenType.Ident, 'wx-host') &&
        expectToken(tokens[2], TokenType.Delim, '=') &&
        expectToken(tokens[3], TokenType.String) &&
        expectToken(tokens[4], TokenType.CloseSquare) &&
        expectToken(tokens[5], TokenType.EOF) !== null
      ) {
        // convert host rules
        rule.selector = ':host'
        rule.styleScope = (tokens[3] as TokenString)[4].value
        return
      }
      for (let i = 0; i < tokens.length; i += 1) {
        // convert class prefixes
        const t = tokens[i]
        if (expectToken(t, TokenType.Delim, '.')) {
          const peek = expectToken(tokens[i + 1], TokenType.Ident)
          if (peek) {
            i += 1
            const [prefix, name] = peek.split('--', 2)
            if (name !== undefined) {
              rule.styleScope = prefix
              tokens[i][1] = name
            }
          }
        }
      }
      rule.selector = stringify(...tokens)
    })
  }

  const calcRuleWeight = (
    ctx: glassEasel.GeneralBackendContext,
    rules: glassEasel.CSSRule[],
  ): glassEasel.CSSRule[] => {
    const rulesWithSelector = rules.map((rule) => {
      if (rule.propertyText !== undefined) {
        const edit = styleEditContext.createOrGetRule(ctx, rule, rule.propertyText)
        rule.properties = edit.getProps()
      }
      const ps = parser().astSync(rule.selector)
      const specificity = selectorSpecificity(ps)
      return [specificity, rule] as const
    })
    rulesWithSelector.sort(([aSpec, aRule], [bSpec, bRule]) => {
      const highBitsDiff = (aRule.weightHighBits || 0) - (bRule.weightHighBits || 0)
      if (highBitsDiff !== 0) return highBitsDiff
      if (aRule.weightLowBits !== undefined || bRule.weightLowBits !== undefined) {
        const lowBitsDiff = (aRule.weightLowBits ?? -1) - (bRule.weightLowBits ?? -1)
        if (lowBitsDiff !== 0) return lowBitsDiff
      }
      const selDiff = selectorCompare(aSpec, bSpec)
      if (selDiff !== 0) return selDiff
      const sheetDiff = aRule.sheetIndex - bRule.sheetIndex
      if (sheetDiff !== 0) return sheetDiff
      const ruleDiff = aRule.ruleIndex - bRule.ruleIndex
      return ruleDiff
    })
    return rulesWithSelector.map(([_sel, rule]) => rule).reverse()
  }

  return new Promise((resolve) => {
    const ctx = element.getBackendContext()
    const elem = element.getBackendElement()
    if (!ctx || !elem) {
      resolve({ inline: [], rules: [] })
      return
    }
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      if (typeof ctx.getMatchedRules === 'function') {
        try {
          ctx.getMatchedRules(elem as glassEasel.domlikeBackend.Element, (ret) => {
            convertAdapterGeneratedRules(ret.rules)
            ret.rules = calcRuleWeight(ctx, ret.rules)
            if (ret.inlineText !== undefined) {
              const edit = styleEditContext.createOrGetInline(elem, ret.inlineText)
              ret.inline = edit.getProps()
            }
            resolve(ret)
          })
        } catch (err) {
          // this may throw when reading cross-origin stylesheets
          resolve({
            inline: [],
            rules: [],
            crossOriginFailing: true,
          })
        }
      } else {
        backendUnsupported('Context#getMatchedRules')
      }
    } else {
      if ('getMatchedRules' in elem) {
        ;(elem as glassEasel.backend.Element).getMatchedRules!((ret) => {
          ret.rules = calcRuleWeight(ctx, ret.rules)
          resolve(ret)
        })
      } else {
        backendUnsupported('Element#getMatchedRules')
      }
    }
  })
}

export class StyleRuleEdit {
  private props: glassEasel.CSSProperty[]

  constructor(props: glassEasel.CSSProperty[]) {
    this.props = props
  }

  static fromInlineStyle(s: string) {
    const ret = new StyleRuleEdit([])
    ret.props = parseNameValueStr(s) ?? []
    return ret
  }

  updateWithProps(props: glassEasel.CSSProperty[]) {
    const oldProps = this.props
    this.props = props
    let i = 0
    oldProps.forEach((prop) => {
      if (prop.disabled) {
        this.props.splice(i, 0, prop)
        i += 1
      }
      while (i < this.props.length) {
        i += 1
        if (prop.name === this.props[i - 1].name) {
          break
        }
      }
    })
  }

  getProps() {
    return this.props.slice()
  }

  clear() {
    this.props.length = 0
  }

  countProps() {
    return this.props.length
  }

  append(inlineStyle: string) {
    const list = parseNameValueStr(inlineStyle) ?? []
    this.props.push(...list)
  }

  setDisabled(index: number, disabled: boolean): boolean {
    if (index >= this.props.length) return false
    this.props[index].disabled = disabled
    return true
  }

  remove(index: number): boolean {
    if (index >= this.props.length) return false
    this.props.splice(index, 1)
    return true
  }

  replace(index: number, inlineStyle: string): boolean {
    if (index >= this.props.length) return false
    const list = parseNameValueStr(inlineStyle) ?? []
    this.props.splice(index, 1, ...list)
    return true
  }

  stringify(): string {
    return this.props
      .map(({ name, value, important, disabled }) => {
        if (disabled) return ''
        if (important) return `${name}: ${value} !important;\n`
        return `${name}: ${value};\n`
      })
      .join('')
  }
}

class StyleEditContext {
  inlineStyleMap = new WeakMap<glassEasel.GeneralBackendElement, StyleRuleEdit>()
  ruleMap = new WeakMap<glassEasel.GeneralBackendContext, Record<string, StyleRuleEdit>>()

  createOrGetInline(elem: glassEasel.GeneralBackendElement, inlineStyle: string): StyleRuleEdit {
    const r = this.inlineStyleMap.get(elem)
    if (r) return r
    const edit = StyleRuleEdit.fromInlineStyle(inlineStyle)
    this.inlineStyleMap.set(elem, edit)
    return edit
  }

  createOrGetRule(
    ctx: glassEasel.GeneralBackendContext,
    rule: glassEasel.CSSRule,
    inlineStyle: string,
  ): StyleRuleEdit {
    const key = `${rule.sheetIndex}/${rule.ruleIndex}`
    const map = this.ruleMap.get(ctx)
    if (!map) {
      const map = Object.create(null) as Record<string, StyleRuleEdit>
      map[key] = StyleRuleEdit.fromInlineStyle(inlineStyle)
      this.ruleMap.set(ctx, map)
      return map[key]
    }
    if (!map[key]) {
      map[key] = StyleRuleEdit.fromInlineStyle(inlineStyle)
      return map[key]
    }
    return map[key]
  }

  updateInline(
    ctx: glassEasel.GeneralBackendContext,
    elem: glassEasel.GeneralBackendElement,
    f: (edit: StyleRuleEdit) => void,
  ) {
    const edit = this.inlineStyleMap.get(elem)
    if (!edit) return
    f(edit)
    const style = edit.stringify()
    if (ctx.mode === glassEasel.BackendMode.Domlike) {
      ;(elem as glassEasel.domlikeBackend.Element).setAttribute('style', style)
    } else if (ctx.mode === glassEasel.BackendMode.Composed) {
      ;(elem as glassEasel.composedBackend.Element).setStyle(style)
    } else if (ctx.mode === glassEasel.BackendMode.Shadow) {
      ;(elem as glassEasel.backend.Element).setStyle(style)
    }
  }

  updateRule(
    ctx: glassEasel.GeneralBackendContext,
    sheetIndex: number,
    ruleIndex: number,
    f: (edit: StyleRuleEdit) => void,
  ): Promise<void> {
    const key = `${sheetIndex}/${ruleIndex}`
    const edit = this.ruleMap.get(ctx)?.[key]
    if (!edit) return Promise.resolve()
    f(edit)
    const style = edit.stringify()
    return new Promise((resolve) => {
      ctx.replaceStyleSheetAllProperties?.(sheetIndex, ruleIndex, style, () => {
        resolve()
      })
    })
  }
}

export const styleEditContext = new StyleEditContext()

export class ClassListEdit {
  private list: { className: string; disabled: boolean }[] = []

  update(names: string[]) {
    const oldList = this.list
    this.list = names.map((className) => ({ className, disabled: false }))
    let i = 0
    oldList.forEach((item) => {
      if (item.disabled) {
        this.list.splice(i, 0, item)
        i += 1
      }
      while (i < this.list.length) {
        i += 1
        if (item.className === this.list[i - 1].className) {
          break
        }
      }
    })
    return this
  }

  setDisabled(className: string, disabled: boolean) {
    const item = this.list.find((x) => x.className === className)
    if (item) item.disabled = disabled
  }

  getClasses() {
    return this.list.slice()
  }

  setClasses(list: { className: string; disabled?: boolean }[]) {
    this.list = []
    list.forEach(({ className, disabled }) => {
      className.split(/\s+/g).forEach((className) => {
        if (!className) return
        this.list.push({ className, disabled: !!disabled })
      })
    })
  }

  stringify() {
    return this.list
      .filter((x) => !x.disabled)
      .map((x) => x.className)
      .join(' ')
  }

  matches(v: string): boolean {
    return this.stringify() === v
  }
}

export class ClassEditContext {
  map = new WeakMap<glassEasel.Element, Record<string, ClassListEdit>>()

  createOrGet(external: string, elem: glassEasel.Element): ClassListEdit {
    if (!this.map.get(elem)) {
      const group = Object.create(null) as Record<string, ClassListEdit>
      this.map.set(elem, group)
    }
    const group = this.map.get(elem)!
    const key = external ?? ''
    if (!group[key]) {
      group[key] = new ClassListEdit()
    }
    return group[key]
  }
}

export const classEditContext = new ClassEditContext()
