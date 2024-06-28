import {
  type AgentRecvMessage,
  type AgentSendMessage,
} from 'glass-easel-devtools-agent/src/protocol'

export type PanelSendMessage = { kind: '' } | { kind: '_init'; tabId: number } | AgentRecvMessage

export type PanelRecvMessage = { kind: '' } | AgentSendMessage
