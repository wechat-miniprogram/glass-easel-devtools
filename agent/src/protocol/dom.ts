import type { Protocol } from 'devtools-protocol'
import type { EventDetail, GlassEaselVar, NodeId, RequestResponse } from './index'

export type AgentEventKind = {
  setChildNodes: SetChildNodes
  childNodeInserted: ChildNodeInserted
  childNodeRemoved: ChildNodeRemoved
  childNodeCountUpdated: ChildNodeCountUpdated
  attributeRemoved: AttributeRemoved
  attributeModified: AttributeModified
  characterDataModified: CharacterDataModified
}

export type AgentRequestKind = {
  describeNode: DescribeNode
  enable: Enable
  getDocument: GetDocument
  pushNodesByBackendIdsToFrontend: PushNodesByBackendIdsToFrontend
  removeAttribute: RemoveAttribute
  setAttributeValue: SetAttributeValue
  setAttributesAsText: SetAttributesAsText
  getAttributes: GetAttributes
  getGlassEaselAttributes: GetGlassEaselAttributes
  getGlassEaselComposedChildren: GetGlassEaselComposedChildren
  requestChildNodes: RequestChildNodes
  removeNode: RemoveNode
  resolveNode: ResolveNode
  setInspectedNode: SetInspectedNode
  setNodeValue: SetNodeValue
  scrollIntoViewIfNeeded: ScrollIntoViewIfNeeded
  getNodeForLocation: GetNodeForLocation
  querySelector: QuerySelector
  querySelectorAll: QuerySelectorAll
  getBoxModel: GetBoxModel
}

export type Quad = [number, number, number, number]

const enum CDPNodeType {
  ELEMENT_NODE = 1,
  ATTRIBUTE_NODE = 2,
  TEXT_NODE = 3,
  DOCUMENT_NODE = 9,
  DOCUMENT_TYPE_NODE = 10,
  DOCUMENT_FRAGMENT_NODE = 11,
}

export const enum GlassEaselNodeType {
  Unknown = 0x100,
  TextNode,
  NativeNode,
  Component,
  VirtualNode,
}

export const glassEaselNodeTypeToCDP = (t: GlassEaselNodeType) => {
  if (t === GlassEaselNodeType.TextNode) return CDPNodeType.TEXT_NODE
  if (t === GlassEaselNodeType.NativeNode) return CDPNodeType.ELEMENT_NODE
  if (t === GlassEaselNodeType.Component) return CDPNodeType.ELEMENT_NODE
  if (t === GlassEaselNodeType.VirtualNode) return CDPNodeType.ELEMENT_NODE
  if (t === GlassEaselNodeType.Unknown) return CDPNodeType.DOCUMENT_NODE
  return CDPNodeType.DOCUMENT_NODE
}

/**
 * Node with simple information.
 */
export type BackendNode = {
  /** The backend node id. */
  backendNodeId: NodeId
  /** The basic type of the node. */
  nodeType: CDPNodeType
  /** The type of the node. */
  glassEaselNodeType: GlassEaselNodeType
  /** The tag name of the node. */
  nodeName: string
  /** Is virtual (virtual node or virtual-host component) or not. */
  virtual: boolean
  /** Is slot-inherited or not. */
  inheritSlots: boolean
}

/**
 * Basic information of a node.
 */
export type Node = BackendNode & {
  /** Node id. */
  nodeId: NodeId
  /** Node id of its parent (if any); for shadow-root, this is its host. */
  parentId?: NodeId
  /** The local name of the node (for components, it is the component name). */
  localName: string
  /** The text content (if any). */
  nodeValue: string
  /** The attributes (see `GetAttributes` for details). */
  attributes: string[]
  /** The count of the core attributes */
  glassEaselAttributeCount: number
  /** The type of the shadow-root type (if any). */
  shadowRootType?: 'open'
  /** The shadow root nodes (if any, at most one child). */
  shadowRoots?: Node[]
  /** The shadow-tree children (can be undefined which means to fetch in future). */
  children?: Node[]
  /** The slot content. */
  distributedNodes?: BackendNode[]
}

/**
 * Inform that the panel is enabled.
 */
export interface DescribeNode extends RequestResponse {
  request: { nodeId?: NodeId; backendNodeId?: NodeId; depth?: number }
  response: { node: Node }
  cdpRequestResponse: [Protocol.DOM.DescribeNodeRequest, Protocol.DOM.DescribeNodeResponse]
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
export interface GetDocument extends RequestResponse {
  request: { depth?: number }
  response: { root: Node }
  cdpRequestResponse: [Protocol.DOM.GetDocumentRequest, Protocol.DOM.GetDocumentResponse]
}

/**
 * Activate some nodes and listening to further mutations.
 */
export interface PushNodesByBackendIdsToFrontend extends RequestResponse {
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
export interface RemoveAttribute extends RequestResponse {
  request: { nodeId: NodeId; name: string }
  cdpRequestResponse: [Protocol.DOM.RemoveAttributeRequest, unknown]
}

/**
 * Set an attribute.
 */
export interface SetAttributeValue extends RequestResponse {
  request: { nodeId: NodeId; name: string; value: string }
  cdpRequestResponse: [Protocol.DOM.SetAttributeValueRequest, unknown]
}

/**
 * Set attributes as text.
 *
 * This method is designed for the compatibilities with CDP (and not preferred).
 */
export interface SetAttributesAsText extends RequestResponse {
  request: { nodeId: NodeId; text: string; name?: string }
  cdpRequestResponse: [Protocol.DOM.SetAttributesAsTextRequest, unknown]
}

/**
 * Get attribute names and values of a node.
 *
 * The name-value pairs are stringified and flattened into a single string array.
 * Common glass-easel managed attributes (e.g. `id` `class` ), datasets, and marks are also included.
 */
export interface GetAttributes extends RequestResponse {
  request: { nodeId: NodeId }
  response: { attributes: string[]; glassEaselAttributeCount: number }
  cdpRequestResponse: [Protocol.DOM.GetAttributesRequest, Protocol.DOM.GetAttributesResponse]
}

/**
 * Get special attribute names of a node.
 */
export interface GetGlassEaselAttributes extends RequestResponse {
  request: { nodeId: NodeId }
  response: {
    glassEaselNodeType: GlassEaselNodeType
    is: string
    id: string
    class: string
    slot: string
    slotName: string | undefined
    slotValues: { name: string; value: GlassEaselVar }[] | undefined
    eventBindings: {
      name: string
      capture: boolean
      count: number
      hasCatch: boolean
      hasMutBind: boolean
    }[]
    normalAttributes?: { name: string; value: GlassEaselVar }[]
    properties?: { name: string; value: GlassEaselVar }[]
    dataset: { name: string; value: GlassEaselVar }[]
    marks: { name: string; value: GlassEaselVar }[]
  }
}

/**
 * Get the composed children of a node.
 */
export interface GetGlassEaselComposedChildren extends RequestResponse {
  request: { nodeId: NodeId }
  response: { nodes: Node[] }
}

/**
 * Get child nodes.
 */
export interface RequestChildNodes extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.RequestChildNodesRequest, unknown]
}

/**
 * Remove a node.
 */
export interface RemoveNode extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.RemoveNodeRequest, unknown]
}

/**
 * Set a node as a global variable.
 */
export interface ResolveNode extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  response: { glassEaselGeneratedVarName: string }
  cdpRequestResponse: [Protocol.DOM.ResolveNodeRequest, Protocol.DOM.ResolveNodeResponse]
}

/**
 * Set the inspected focusing node.
 */
export interface SetInspectedNode extends RequestResponse {
  request: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.SetInspectedNodeRequest, unknown]
}

/**
 * Set the text content.
 */
export interface SetNodeValue extends RequestResponse {
  request: { nodeId: NodeId; value: string }
  cdpRequestResponse: [Protocol.DOM.SetNodeValueRequest, unknown]
}

/**
 * Scroll to show the target element.
 */
export interface ScrollIntoViewIfNeeded extends RequestResponse {
  request: { nodeId: NodeId } | { backendNodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.ScrollIntoViewIfNeededRequest, unknown]
}

/**
 * Element from X/Y location.
 */
export interface GetNodeForLocation extends RequestResponse {
  request: { x: number; y: number }
  response: { backendNodeId: NodeId }
  cdpRequestResponse: [
    Protocol.DOM.GetNodeForLocationRequest,
    Protocol.DOM.GetNodeForLocationResponse,
  ]
}

/**
 * Query selector.
 */
export interface QuerySelector extends RequestResponse {
  request: { nodeId: NodeId; selector: string }
  response: { nodeId: NodeId }
  cdpRequestResponse: [Protocol.DOM.QuerySelectorRequest, Protocol.DOM.QuerySelectorResponse]
}

/**
 * Query selector for all nodes.
 */
export interface QuerySelectorAll extends RequestResponse {
  request: { nodeId: NodeId; selector: string }
  response: { nodeIds: NodeId[] }
  cdpRequestResponse: [Protocol.DOM.QuerySelectorAllRequest, Protocol.DOM.QuerySelectorAllResponse]
}

/**
 * Get box model and related information.
 */
export interface GetBoxModel extends RequestResponse {
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

export interface SetChildNodes extends EventDetail {
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

export interface AttributeRemoved extends EventDetail {
  detail: { nodeId: NodeId; name: string }
  cdpEventDetail: Protocol.DOM.AttributeRemovedEvent
}

export interface AttributeModified extends EventDetail {
  detail: { nodeId: NodeId; name: string; value: string; detail: GlassEaselVar }
  cdpEventDetail: Protocol.DOM.AttributeModifiedEvent
}

export interface CharacterDataModified extends EventDetail {
  detail: { nodeId: NodeId; characterData: string }
  cdpEventDetail: Protocol.DOM.CharacterDataModifiedEvent
}
