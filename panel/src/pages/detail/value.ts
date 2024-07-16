import { type protocol } from 'glass-easel-devtools-agent'

Component()
  .property('value', {
    type: Object,
    value: null as null | protocol.GlassEaselVar,
  })
  .data(() => ({
    slices: [] as { dynamic: boolean; str: string }[],
    allowInspect: false,
  }))
  .init(({ setData, observer }) => {
    observer('value', (v) => {
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
        setData({ slices: [{ dynamic: true, str: 'Function' }], allowInspect: true })
      } else if (v.type === 'object') {
        setData({ slices: [{ dynamic: true, str: 'Object' }], allowInspect: true })
      } else if (v.type === 'array') {
        setData({ slices: [{ dynamic: true, str: 'Array' }], allowInspect: true })
      }
    })
  })
  .register()
