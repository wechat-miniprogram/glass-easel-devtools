import * as glassEasel from 'glass-easel'
import { type protocol } from 'glass-easel-devtools-agent'
import { sendRequest } from '../../message_channel'

Component()
  .options({
    virtualHost: true,
    dataDeepCopy: glassEasel.DeepCopyKind.None,
    propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
  })
  .property('primitiveValue', null)
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
    updateHighlight: false,
  }))
  .init(({ self, data, setData, observer, method }) => {
    let prevNodeId = 0
    observer(['value', 'primitiveValue'], () => {
      const v: protocol.GlassEaselVar = data.value ?? {
        type: 'primitive',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        value: data.primitiveValue,
      }
      if (!v) {
        setData({ slices: [], allowInspect: false })
        return
      }
      if (data.nodeId === prevNodeId) {
        updatedAni()
      } else {
        prevNodeId = data.nodeId
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

    let updateAniEndTimeout = 0
    const updatedAni = method(() => {
      setTimeout(() => {
        if (data.updateHighlight) {
          setData({ updateHighlight: false })
          updatedAni()
          return
        }
        if (updateAniEndTimeout) {
          clearTimeout(updateAniEndTimeout)
          updateAniEndTimeout = 0
        }
        self.setData({ updateHighlight: true, varName: '' })
        updateAniEndTimeout = setTimeout(() => {
          updateAniEndTimeout = 0
          setData({ updateHighlight: false })
        }, 1000)
      }, 200)
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
