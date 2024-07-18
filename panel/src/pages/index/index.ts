import { DeepCopyKind } from 'glass-easel'
import { initStoreBindings } from 'mobx-miniprogram-bindings'
import { type protocol, sendRequest, setEventHandler } from '../../message_channel'
import { compDef as treeCompDef } from '../tree/element'
import { store } from '../store'
import { childNodeInserted } from '../../events'
import { error } from '../../utils'

export const componentDefinition = Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
  })
  .data(() => ({
    mountPoints: [] as protocol.dom.Node[],
    inSelectMode: false,
  }))
  .init((ctx) => {
    const { self, data, setData, method, listener } = ctx

    // collect document
    const initDocument = async () => {
      await sendRequest('DOM.enable', {})
      const res = await sendRequest('DOM.getDocument', { depth: 3 })
      setData({ mountPoints: res.root.children ?? [] })
    }
    childNodeInserted.bindComponentLifetimes(
      ctx,
      () => 1,
      ({ previousNodeId, node }) => {
        const after = data.mountPoints.map((x) => x.nodeId).indexOf(previousNodeId)
        const before = after + 1
        self.groupUpdates(() => {
          self.spliceArrayDataOnPath(['mountPoints'], before, 0, [node])
        })
      },
    )

    initStoreBindings(ctx, { store, fields: ['selectedNodeId'] })

    const treeSpaceTap = listener(() => {
      store.selectNode(0)
    })

    // node select
    const toggleSelectMode = listener(() => {
      if (!data.inSelectMode) {
        setData({ inSelectMode: true })
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendRequest('Overlay.setInspectMode', { mode: 'searchForNode' })
      } else {
        setData({ inSelectMode: false })
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        sendRequest('Overlay.setInspectMode', { mode: 'none' })
      }
    })
    setEventHandler('Overlay.inspectModeCanceled', () => {
      setData({ inSelectMode: false })
      store.setHighlightNode(0)
    })
    setEventHandler('Overlay.nodeHighlightRequested', ({ nodeId }) => {
      store.setHighlightNode(nodeId)
    })
    setEventHandler('Overlay.inspectNodeRequested', ({ backendNodeId }) => {
      const nodePath: protocol.dom.Node[] = []
      const rec = async (backendNodeId: protocol.NodeId) => {
        const { node } = await sendRequest('DOM.describeNode', { backendNodeId, depth: 2 })
        if (node.parentId) await rec(node.parentId)
        nodePath.push(node)
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises, promise/catch-or-return
      Promise.resolve().then(async () => {
        await rec(backendNodeId)
        const tree = self.selectComponent(`#mount-point-${nodePath[0].nodeId}`, treeCompDef)
        if (tree) {
          await tree.visitChildNodePath(nodePath)
        } else {
          error(`cannot find child node id ${nodePath[0].nodeId}`)
        }
        return undefined
      })
    })

    // reconnect, clear elements, and fetch all elements
    const restart = method(() => {
      setData({ mountPoints: [] })
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      initDocument()
    })

    return {
      treeSpaceTap,
      toggleSelectMode,
      restart,
    }
  })
  .register()
