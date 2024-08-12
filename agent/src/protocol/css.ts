import type { Protocol } from 'devtools-protocol'
import type { EventDetail, NodeId, RequestResponse } from './index'

export type AgentEventKind = {
  fontsUpdated: FontsUpdated
  mediaQueryResultChanged: MediaQueryResultChanged
  styleSheetAdded: StyleSheetAdded
  styleSheetChanged: StyleSheetChanged
  styleSheetRemoved: StyleSheetRemoved
}

export type AgentRequestKind = {
  getComputedStyleForNode: GetComputedStyleForNode
  getInlineStylesForNode: GetInlineStylesForNode
  getMatchedStylesForNode: GetMatchedStylesForNode
  addGlassEaselStyleSheetRule: AddGlassEaselStyleSheetRule
  getGlassEaselStyleSheetIndexForNewRules: GetGlassEaselStyleSheetIndexForNewRules
  resetGlassEaselStyleSheetRule: ResetGlassEaselStyleSheetRule
  modifyGlassEaselStyleSheetRuleSelector: ModifyGlassEaselStyleSheetRuleSelector
  addGlassEaselStyleSheetProperty: AddGlassEaselStyleSheetProperty
  setGlassEaselStyleSheetPropertyDisabled: SetGlassEaselStyleSheetPropertyDisabled
  removeGlassEaselStyleSheetProperty: RemoveGlassEaselStyleSheetProperty
  replaceGlassEaselStyleSheetProperty: ReplaceGlassEaselStyleSheetProperty
  replaceGlassEaselStyleSheetAllProperties: ReplaceGlassEaselStyleSheetAllProperties
  replaceGlassEaselStyleSheetInlineStyle: ReplaceGlassEaselStyleSheetInlineStyle
}

export type StyleSheetId = string

export type CSSNameValue = { name: string; value: string }

export type CSSProperty = CSSNameValue & {
  /** `!important` status */
  important?: boolean
  /** the original style text */
  text?: string
  /** parse success or not */
  parseOk?: boolean
  /** disabled or not */
  disabled?: boolean
}

export type CSSStyle = {
  styleSheetId?: StyleSheetId
  cssProperties: CSSProperty[]
  cssText?: string
}

export type CSSRule = {
  styleSheetId?: StyleSheetId
  selectorList: { selectors: { text: string }[]; text: string }
  style: CSSStyle
  media?: { styleSheetId?: StyleSheetId; text: string }[]
  inactive?: boolean
}

export type CSSMatchedRule = {
  rule: CSSRule
}

/**
 * Get computed style of a node.
 */
export interface GetComputedStyleForNode extends RequestResponse {
  request: { nodeId: NodeId }
  response: { computedStyle: CSSNameValue[] }
  cdpRequestResponse: [
    Protocol.CSS.GetComputedStyleForNodeRequest,
    Protocol.CSS.GetComputedStyleForNodeResponse,
  ]
}

/**
 * Get inline styles of a node.
 */
export interface GetInlineStylesForNode extends RequestResponse {
  request: { nodeId: NodeId }
  response: { inlineStyle: CSSStyle }
  cdpRequestResponse: [
    Protocol.CSS.GetInlineStylesForNodeRequest,
    Protocol.CSS.GetInlineStylesForNodeResponse,
  ]
}

/**
 * Get matched styles of a node.
 */
export interface GetMatchedStylesForNode extends RequestResponse {
  request: { nodeId: NodeId }
  response: {
    inlineStyle: CSSStyle
    matchedCSSRules: CSSMatchedRule[]
    inherited: { inlineStyle?: CSSStyle; matchedCSSRules: CSSMatchedRule[] }[]
    crossOriginFailing?: boolean
  }
  cdpRequestResponse: [
    Protocol.CSS.GetMatchedStylesForNodeRequest,
    Protocol.CSS.GetMatchedStylesForNodeResponse,
  ]
}

/**
 * Add a new CSS rule.
 */
export interface AddGlassEaselStyleSheetRule extends RequestResponse {
  request: { mediaQueryText: string; selector: string }
}

/**
 * Get the style sheet for temporary rules.
 */
export interface GetGlassEaselStyleSheetIndexForNewRules extends RequestResponse {
  request: Record<string, never>
  response: { styleSheetId: StyleSheetId }
}

/**
 * Clear a CSS rule.
 */
export interface ResetGlassEaselStyleSheetRule extends RequestResponse {
  request: { styleSheetId: StyleSheetId; ruleIndex: number }
}

/**
 * Modify the CSS rule selector.
 */
export interface ModifyGlassEaselStyleSheetRuleSelector extends RequestResponse {
  request: { styleSheetId: StyleSheetId; ruleIndex: number; selector: string }
}

/**
 * Add a new CSS property.
 */
export interface AddGlassEaselStyleSheetProperty extends RequestResponse {
  request: { styleSheetId: StyleSheetId; ruleIndex: number; styleText: string }
}

/**
 * Set the disabled status of a new CSS property.
 */
export interface SetGlassEaselStyleSheetPropertyDisabled extends RequestResponse {
  request: {
    styleSheetId: StyleSheetId
    ruleIndex: number
    propertyIndex: number
    disabled: boolean
  }
}

/**
 * Remove a CSS property.
 */
export interface RemoveGlassEaselStyleSheetProperty extends RequestResponse {
  request: {
    styleSheetId: StyleSheetId
    ruleIndex: number
    propertyIndex: number
  }
}

/**
 * Replace a CSS property.
 */
export interface ReplaceGlassEaselStyleSheetProperty extends RequestResponse {
  request: {
    styleSheetId: StyleSheetId
    ruleIndex: number
    propertyIndex: number
    styleText: string
  }
}

/**
 * Replace all CSS properties.
 */
export interface ReplaceGlassEaselStyleSheetAllProperties extends RequestResponse {
  request: {
    styleSheetId: StyleSheetId
    ruleIndex: number
    styleText: string
  }
}

/**
 * Replace inline style for a node.
 */
export interface ReplaceGlassEaselStyleSheetInlineStyle extends RequestResponse {
  request: {
    nodeId: NodeId
    styleText: string
  }
}

export interface FontsUpdated extends EventDetail {
  detail: Record<string, never>
  cdpEventDetail: unknown
}

export interface MediaQueryResultChanged extends EventDetail {
  detail: Record<string, never>
  cdpEventDetail: unknown
}

export interface StyleSheetAdded extends EventDetail {
  detail: {
    header: {
      styleSheetId: StyleSheetId
      sourceURL?: string
    }
  }
  cdpEventDetail: Protocol.CSS.StyleSheetAddedEvent
}

export interface StyleSheetChanged extends EventDetail {
  detail: { styleSheetId: string }
  cdpEventDetail: Protocol.CSS.StyleSheetChangedEvent
}

export interface StyleSheetRemoved extends EventDetail {
  detail: { styleSheetId: string }
  cdpEventDetail: Protocol.CSS.StyleSheetRemovedEvent
}
