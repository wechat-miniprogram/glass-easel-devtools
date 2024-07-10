import { DeepCopyKind } from 'glass-easel'
import { type protocol } from 'glass-easel-devtools-agent'
import { childNodeCountUpdated, registerNodeEventListener } from '../../events'

type AttributeMeta = { name: string; value: string; isProperty: boolean }

Component()
  .options({
    dataDeepCopy: DeepCopyKind.None,
    propertyPassingDeepCopy: DeepCopyKind.None,
    propertyEarlyInit: true,
  })
  .property('nodeInfo', {
    type: Object,
    value: null as protocol.dom.Node | null,
  })
  .data(() => ({
    hasChildNodes: true,
    tagName: '',
    attributes: [] as AttributeMeta[],
  }))
  .init((ctx) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { data, setData, observer } = ctx
    let nodeId = 0

    registerNodeEventListener(childNodeCountUpdated, ctx, nodeId, (args) => {
      setData({ hasChildNodes: args.childNodeCount > 0 })
    })

    observer('nodeInfo', () => {
      nodeId = data.nodeInfo?.nodeId ?? 0
      const tagName = data.nodeInfo?.nodeName ?? ''
      const nv = data.nodeInfo?.attributes ?? []
      const attributes = [] as AttributeMeta[]
      for (let i = 0; i < nv.length; i += 2) {
        const n = nv[i]
        const v = nv[i + 1] ?? ''
        if (n.startsWith(':')) {
          attributes.push({ name: n.slice(1), value: v, isProperty: false })
        } else {
          attributes.push({ name: n, value: v, isProperty: true })
        }
      }
      setData({ tagName, attributes })
      const childNodeCount = data.nodeInfo?.children?.length
      if (childNodeCount !== undefined) {
        setData({ hasChildNodes: childNodeCount > 0 })
      }
    })
  })
  .register()
