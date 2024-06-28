export type AgentSendMessage =
  | { kind: '' }
  | { kind: 'event'; name: string; detail: any }
  | { kind: 'response'; id: number; detail: any }
  | { kind: 'error'; id: number; message?: string; stack?: string }

export type AgentRecvMessage =
  | { kind: '' }
  | { kind: 'request'; id: number; name: string; detail: any }

export type AgentEventKind = {
  addMountPoint: AddMountPoint
  removeMountPoint: RemoveMountPoint
}

export type AgentRequestKind = {
  getChildNodes: GetChildNodes
  getBoundingClientRect: GetBoundingClientRect
}

/// Add a new mount point
export type AddMountPoint = {
  nodeId: number
}

/// Remove a mount point
export type RemoveMountPoint = {
  nodeId: number
}

/// Get child nodes
export type GetChildNodes = {
  request: { nodeId: number }
  response: { nodeId: number }
}

/// Get bounding client rect
export type GetBoundingClientRect = {
  request: { nodeId: number }
  response: { left: number; top: number; right: number; bottom: number }
}
