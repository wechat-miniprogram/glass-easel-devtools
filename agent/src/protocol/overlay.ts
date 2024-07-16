import type { Protocol } from 'devtools-protocol'
import type { EventDetail, NodeId, RequestResponse } from './index'

export type AgentRequestKind = {
  highlightNode: HighlightNode
  hideHighlight: HideHighlight
  setInspectMode: SetInspectMode
}

export type AgentEventKind = {
  inspectModeCanceled: InspectModeCanceled
  inspectNodeRequested: InspectNodeRequested
  nodeHighlightRequested: NodeHighlightRequested
}

/**
 * Highlight a node.
 */
export interface HighlightNode extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  cdpRequestResponse: [Protocol.Overlay.HighlightNodeRequest, unknown]
}

/**
 * Remove the highlight.
 */
export interface HideHighlight extends RequestResponse {
  request: Record<string, never>
  cdpRequestResponse: [unknown, unknown]
}

/**
 * Remove the highlight.
 */
export interface SetInspectMode extends RequestResponse {
  request: { mode: 'searchForNode' | 'none' }
  cdpRequestResponse: [Protocol.Overlay.SetInspectModeRequest, unknown]
}

/**
 * Inspect focusing a node.
 */
export interface InspectModeCanceled extends EventDetail {
  detail: { backendNodeId: NodeId }
  cdpEventDetail: unknown
}

/**
 * Inspect focusing a node.
 */
export interface InspectNodeRequested extends EventDetail {
  detail: { backendNodeId: NodeId }
  cdpEventDetail: Protocol.Overlay.InspectNodeRequestedEvent
}

/**
 * Inspect highlighting a node.
 */
export interface NodeHighlightRequested extends EventDetail {
  detail: { nodeId: NodeId }
  cdpEventDetail: Protocol.Overlay.NodeHighlightRequestedEvent
}
