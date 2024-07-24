import { makeAutoObservable } from 'mobx-miniprogram'
import { type protocol } from 'glass-easel-devtools-agent'
import { sendRequest } from '../message_channel'

export const store = makeAutoObservable({
  selectedNodeId: 0 as protocol.NodeId,
  highlightNodeId: 0 as protocol.NodeId,
  sideBarShown: false,

  selectNode(n: protocol.NodeId) {
    this.selectedNodeId = n
    this.sideBarShown = n > 0
    // if (n > 0) {
    //   // eslint-disable-next-line @typescript-eslint/no-floating-promises
    //   sendRequest('DOM.setInspectedNode', { nodeId: n })
    // }
  },

  hideSideBar() {
    this.sideBarShown = false
  },

  setHighlightNode(n: protocol.NodeId) {
    this.highlightNodeId = n
    if (n > 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      sendRequest('Overlay.highlightNode', { nodeId: n })
    } else {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      sendRequest('Overlay.hideHighlight', {})
    }
  },
})
