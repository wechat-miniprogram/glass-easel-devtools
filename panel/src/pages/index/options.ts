import { componentDefinition as view, viewUtils } from '../../global_components/view/view'
import { type UserConfig, store } from '../store'

export const componentDefinition = Component()
  .property('shown', Boolean)
  .property('options', {
    type: Object,
    value: {
      hideInherit: true,
      hideVirtual: false,
      showComposed: false,
    } as UserConfig,
  })
  .init(({ self, observer, listener }) => {
    observer('shown', (shown) => {
      if (shown) {
        setTimeout(() => {
          const wrapper = self.selectComponent('.wrapper', view)!.traitBehavior(viewUtils)!
          wrapper.focus()
        }, 0)
      }
    })
    const blur = listener(() => {
      self.setData({ shown: false })
    })
    observer('options.**', (options) => {
      store.setUserConfig(options)
    })
    return { blur }
  })
  .register()
