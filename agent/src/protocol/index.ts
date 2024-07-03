import type * as dom from './dom'
import type * as css from './css'
import type * as overlay from './overlay'

export * from './var'
export type * as dom from './dom'
export type * as css from './css'
export type * as overlay from './overlay'

export type AgentSendMessage =
  | { kind: '' }
  | { kind: 'event'; name: string; detail: any }
  | { kind: 'response'; id: number; detail: any }
  | { kind: 'error'; id: number; message?: string; stack?: string }

export type AgentRecvMessage =
  | { kind: '' }
  | { kind: 'request'; id: number; name: string; detail: any }

type Impl<T, U extends T> = U

export interface EventDetail {
  detail: unknown
  cdpEventDetail?: unknown
}

export interface RequestResponse {
  request: unknown
  response: unknown
  cdpRequestResponse?: [unknown, unknown]
}

type KeyPrefix<P extends string, R extends Record<string, any>> = {
  [T in keyof R as T extends string ? `${P}.${T}` : never]: R[T]
}

export type AgentEventKind = Impl<
  Record<string, EventDetail>,
  KeyPrefix<'DOM', dom.AgentEventKind> & KeyPrefix<'CSS', css.AgentEventKind>
>

export type AgentRequestKind = Impl<
  Record<string, RequestResponse>,
  KeyPrefix<'DOM', dom.AgentRequestKind> &
    KeyPrefix<'CSS', css.AgentRequestKind> &
    KeyPrefix<'Overlay', overlay.AgentRequestKind>
>

/** The node id ( `0` is preserved). */
export type NodeId = number
