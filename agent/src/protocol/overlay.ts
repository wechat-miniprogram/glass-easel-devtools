import type { Protocol } from 'devtools-protocol'
import type { NodeId, RequestResponse } from './index'

export type AgentRequestKind = {
  highlightNode: HighlightNode
  hideHighlight: HideHighlight
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
