import { type protocol } from 'glass-easel-devtools-agent'
import { sendRequest } from '../../message_channel'

Component()
  .property('value', {
    type: Object,
    value: null as null | protocol.GlassEaselVar,
  })
  .property('varName', String)
  .property('nodeId', Number)
  .property('attribute', String)
  .data(() => ({
    slices: [] as { dynamic: boolean; str: string }[],
    allowInspect: false,
  }))
  .init(({ self, data, setData, observer, method }) => {
    observer(['value', 'nodeId', 'attribute'], () => {
      const v = data.value
      if (!v) {
        setData({ slices: [], allowInspect: false })
        return
      }
      if (v.type === 'primitive') {
        if (v.value === null) {
          setData({ slices: [{ dynamic: true, str: 'null' }], allowInspect: false })
        } else if (v.value === undefined) {
          setData({ slices: [{ dynamic: true, str: 'undefined' }], allowInspect: false })
        } else if (typeof v.value === 'string') {
          setData({
            slices: [
              { dynamic: false, str: '"' },
              { dynamic: true, str: v.value },
              { dynamic: false, str: '"' },
            ],
            allowInspect: false,
          })
        } else {
          setData({ slices: [{ dynamic: true, str: String(v.value) }], allowInspect: false })
        }
      } else if (v.type === 'symbol') {
        setData({
          slices: [
            { dynamic: false, str: 'Symbol(' },
            { dynamic: true, str: v.value },
            { dynamic: false, str: ')' },
          ],
          allowInspect: false,
        })
      } else if (v.type === 'function') {
        setData({ slices: [{ dynamic: true, str: 'Function' }], allowInspect: data.nodeId > 0 })
      } else if (v.type === 'object') {
        setData({ slices: [{ dynamic: true, str: 'Object' }], allowInspect: data.nodeId > 0 })
      } else if (v.type === 'array') {
        setData({ slices: [{ dynamic: true, str: 'Array' }], allowInspect: data.nodeId > 0 })
      }
    })

    const useInConsole = method(async () => {
      const { nodeId, attribute } = data
      const { varName } = await sendRequest('DOM.useGlassEaselAttributeInConsole', {
        nodeId,
        attribute,
      })
      self.setData({ varName })
    })

    return { useInConsole }
  })
  .register()
