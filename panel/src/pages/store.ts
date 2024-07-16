import { makeAutoObservable } from 'mobx-miniprogram'
import { type protocol } from 'glass-easel-devtools-agent'
import { sendRequest } from '../message_channel'

export const store = makeAutoObservable({
  selectedNodeId: null as protocol.NodeId | null,

  selectNode(n: protocol.NodeId) {
    this.selectedNodeId = n
    if (n > 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      sendRequest('DOM.setInspectedNode', { nodeId: n })
    }
  },
})
