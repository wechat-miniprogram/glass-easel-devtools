import type { Protocol } from 'devtools-protocol'
import type { EventDetail, NodeId, RequestResponse } from './index'

export type Quad = [number, number, number, number]

// const enum CDPNodeType {
//   ELEMENT_NODE = 1,
//   ATTRIBUTE_NODE = 2,
//   TEXT_NODE = 3,
//   DOCUMENT_NODE = 9,
//   DOCUMENT_TYPE_NODE = 10,
//   DOCUMENT_FRAGMENT_NODE = 11,
// }

const enum GlassEaselNodeType {
  Document = 0x100,
  TextNode,
  NativeNode,
  Component,
  VirtualNode,
}

/**
 * Node with simple information.
 */
export type BackendNode = {
  /** The backend node id. */
  backendNodeId: NodeId
  /** The type of the node. */
  nodeType: GlassEaselNodeType
  /** The tag name of the node. */
  nodeName: string
}

/**
 * Basic information of a node.
 */
export type Node = BackendNode & {
  /** Node id. */
  nodeId: NodeId
  /** Node id of its parent (if any). */
  parentId?: NodeId
  /** The local name of the node (for components, it is the component name). */
  localName: string
  /** The text content (if any). */
  nodeValue: string
  /** The attributes (name-value pairs are stringified and flattened into a single string array). */
  attributes: string[]
  /** The shadow-tree children (can be undefined which means to fetch in future). */
  children?: Node[]
  /** The slot content. */
  distributedNodes?: BackendNode[]
}

/**
 * Inform that the panel is enabled.
 */
export interface Enable extends RequestResponse {
  request: Record<string, never>
  cdpRequestResponse: [Protocol.DOM.EnableRequest, unknown]
}

/**
 * Retrive the top-level document.
 *
 * This will always return a node that contains all mount points.
 * The `nodeId` of it is always `1` .
 */
interface GetDocument extends RequestResponse {
  request: Record<string, never>
  response: { root: Node }
  cdpRequestResponse: [Protocol.DOM.GetDocumentRequest, Protocol.DOM.GetDocumentResponse]
}

/**
 * Activate some nodes and listening to further mutations.
 */
interface PushNodesByBackendIdsToFrontend extends RequestResponse {
  request: { backendNodeIds: NodeId[] }
  response: { nodeIds: NodeId[] }
  cdpRequestResponse: [
    Protocol.DOM.PushNodesByBackendIdsToFrontendRequest,
    Protocol.DOM.PushNodesByBackendIdsToFrontendResponse,
  ]
}

/**
 * Remove an attribute.
 */
interface RemoveAttribute extends RequestResponse {
  request: { nodeId: NodeId; name: string }
  cdpRequestResponse: [Protocol.DOM.RemoveAttributeRequest, unknown]
}

/**
 * Set an attribute.
 */
interface SetAttributeValue extends RequestResponse {
  request: { nodeId: NodeId; name: string; value: string }
  cdpRequestResponse: [Protocol.DOM.SetAttributeValueRequest, unknown]
}

/**
 * Set attributes as text.
 *
 * This method is designed for the compatibilities with CDP (and not preferred).
 */
interface SetAttributesAsText extends RequestResponse {
  request: { nodeId: NodeId; text: string; name?: string }
  cdpRequestResponse: [Protocol.DOM.SetAttributesAsTextRequest, unknown]
}

/**
 * Get attribute names and values of a node.
 *
 * The name-value pairs are stringified and flattened into a single string array.
 * Common glass-easel managed attributes (e.g. `id` `class` ) are returned when they are not initial value.
 */
interface GetAttributes extends RequestResponse {
  request: { nodeId: NodeId }
  response: { attributes: string[] }
  cdpRequestResponse: [Protocol.DOM.GetAttributesRequest, Protocol.DOM.GetAttributesResponse]
}

/**
 * Get special attribute names of a node.
 */
interface GetGlassEaselAttributes extends RequestResponse {
  request: { nodeId: NodeId }
  response: { datasets: []; marks: []; eventBindings: [] }
}

/**
 * Get child nodes.
 */
interface RequestChildNodes extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.RequestChildNodesRequest, unknown]
}

/**
 * Remove a node.
 */
interface RemoveNode extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.RemoveNodeRequest, unknown]
}

/**
 * Set a node as a global variable.
 */
interface ResolveNode extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  response: { glassEaselGeneratedVarName: string }
  cdpRequestResponse: [Protocol.DOM.ResolveNodeRequest, Protocol.DOM.ResolveNodeResponse]
}

/**
 * Set the inspected focusing node.
 */
interface SetInspectedNode extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.SetInspectedNodeRequest, unknown]
}

/**
 * Set the text content.
 */
interface SetNodeValue extends RequestResponse {
  request: { nodeId: NodeId; value: string }
  cdpRequestResponse: [Protocol.DOM.SetNodeValueRequest, unknown]
}

/**
 * Scroll to show the target element.
 */
interface ScrollIntoViewIfNeeded extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.ScrollIntoViewIfNeededRequest, unknown]
}

/**
 * Element from X/Y location.
 */
interface GetNodeForLocation extends RequestResponse {
  request: { x: number; y: number }
  response: { backendNodeId: NodeId }
  cdpRequestResponse: [
    Protocol.DOM.GetNodeForLocationRequest,
    Protocol.DOM.GetNodeForLocationResponse,
  ]
}

/**
 * Highlight a node.
 */
interface HighlightNode extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  cdpRequestResponse: [Protocol.Overlay.HighlightNodeRequest, unknown]
}

/**
 * Remove the highlight.
 */
interface HideHighlight extends RequestResponse {
  request: Record<string, never>
  cdpRequestResponse: [unknown, unknown]
}

/**
 * Query selector.
 */
interface QuerySelector extends RequestResponse {
  request: { nodeId: NodeId; selector: string }
  response: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.QuerySelectorRequest, Protocol.DOM.QuerySelectorResponse]
}

/**
 * Query selector for all nodes.
 */
interface QuerySelectorAll extends RequestResponse {
  request: { nodeId: NodeId; selector: string }
  response: { nodeIds: NodeId[] }
  cdpRequestResponse: [Protocol.DOM.QuerySelectorAllRequest, Protocol.DOM.QuerySelectorAllResponse]
}

/**
 * Get box model and related information.
 */
interface GetBoxModel extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  response: {
    content: Quad
    padding: Quad
    border: Quad
    margin: Quad
    width: number
    height: number
  }
  cdpRequestResponse: [Protocol.DOM.GetBoxModelRequest, Protocol.DOM.GetBoxModelResponse]
}

interface SetChildNodes extends EventDetail {
  detail: { parentId: NodeId; nodes: Node[] }
  cdpEventDetail: Protocol.DOM.SetChildNodesEvent
}

/**
 * A new child node is inserted.
 *
 * `previousNodeId` can be `0` which means insertion as the first child.
 */
export interface ChildNodeInserted extends EventDetail {
  detail: { parentNodeId: NodeId; previousNodeId: NodeId; node: Node }
  cdpEventDetail: Protocol.DOM.ChildNodeInsertedEvent
}

/**
 * A child node is removed.
 */
export interface ChildNodeRemoved extends EventDetail {
  detail: { parentNodeId: NodeId; nodeId: NodeId }
  cdpEventDetail: Protocol.DOM.ChildNodeRemovedEvent
}

export interface ChildNodeCountUpdated extends EventDetail {
  detail: { nodeId: NodeId; childNodeCount: number }
  cdpEventDetail: Protocol.DOM.ChildNodeCountUpdatedEvent
}

interface AttributeRemoved extends EventDetail {
  detail: { nodeId: NodeId; name: string }
  cdpEventDetail: Protocol.DOM.AttributeRemovedEvent
}

interface AttributeModified extends EventDetail {
  detail: { nodeId: NodeId; name: string; value: string }
  cdpEventDetail: Protocol.DOM.AttributeModifiedEvent
}

interface CharacterDataModified extends EventDetail {
  detail: { nodeId: NodeId; characterData: string }
  cdpEventDetail: Protocol.DOM.CharacterDataModifiedEvent
}
