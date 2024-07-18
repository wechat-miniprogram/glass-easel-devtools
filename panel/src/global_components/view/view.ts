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
    return { hoverStart, hoverEnd }
  })
  .register()
