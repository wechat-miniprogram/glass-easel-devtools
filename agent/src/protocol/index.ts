import type * as dom from './dom'
import type * as css from './css'

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

export type AgentEventKind = Impl<
  Record<string, EventDetail>,
  {
    fontsUpdated: css.FontsUpdated
  }
>

export type AgentRequestKind = Impl<
  Record<string, RequestResponse>,
  {
    enable: dom.Enable
  }
>

/** The node id ( `0` is preserved). */
export type NodeId = number
