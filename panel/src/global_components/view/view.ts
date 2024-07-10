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
  .init(({ setData, method }) => {
    const hoverStart = method(() => {
      setData({ hover: true })
    })
    const hoverEnd = method(() => {
      setData({ hover: false })
    })
    return { hoverStart, hoverEnd }
  })
  .register()
