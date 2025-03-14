interface ViewUtils {
  focus(): void
}

export const viewUtils = Behavior.trait<ViewUtils>()

export const componentDefinition = Component()
  .options({
    virtualHost: true,
  })
  .externalClasses(['class', 'hover-class'])
  .property('style', String)
  .property('hidden', Boolean)
  .property('focusEnabled', Boolean)
  .data(() => ({
    hover: false,
  }))
  .init(({ self, setData, listener, implement }) => {
    const hoverStart = listener((ev) => {
      setData({ hover: true })
      self.triggerEvent('mouseenter', ev.detail, {})
    })
    const hoverEnd = listener((ev) => {
      setData({ hover: false })
      self.triggerEvent('mouseleave', ev.detail, {})
    })
    const mousedown = listener((ev) => {
      self.triggerEvent('mousedown', ev.detail, {})
    })
    const mousemove = listener((ev) => {
      self.triggerEvent('mousemove', ev.detail, {})
    })
    const mouseup = listener((ev) => {
      self.triggerEvent('mouseup', ev.detail, {})
    })
    const touchstart = listener((ev) => {
      self.triggerEvent('touchstart', ev.detail, {})
    })
    const touchmove = listener((ev) => {
      self.triggerEvent('touchmove', ev.detail, {})
    })
    const touchend = listener((ev) => {
      self.triggerEvent('touchend', ev.detail, {})
    })
    const bindfocus = listener(() => {
      self.triggerEvent('focus', undefined, {})
    })
    const bindblur = listener(() => {
      self.triggerEvent('blur', undefined, {})
    })
    implement(viewUtils, {
      focus() {
        const be = self._$.getShadowRoot()?.childNodes[0]?.getBackendElement()
        if (be instanceof HTMLElement) {
          be.focus()
        }
      },
    })
    return {
      hoverStart,
      hoverEnd,
      mousedown,
      mousemove,
      mouseup,
      touchstart,
      touchmove,
      touchend,
      bindfocus,
      bindblur,
    }
  })
  .register()
