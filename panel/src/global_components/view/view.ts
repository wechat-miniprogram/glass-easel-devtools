export const componentDefinition = Component()
  .options({
    virtualHost: true,
  })
  .externalClasses(['class', 'hover-class'])
  .property('style', String)
  .property('hidden', Boolean)
  .data(() => ({
    hover: false,
  }))
  .init(({ self, setData, listener }) => {
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
    return { hoverStart, hoverEnd, mousedown, mousemove, mouseup, touchstart, touchmove, touchend }
  })
  .register()
