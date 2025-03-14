export const componentDefinition = Component()
  .property('checked', Boolean)
  .init(({ listener, self }) => {
    const check = listener(() => {
      self.setData({ checked: !self.data.checked })
    })
    return { check }
  })
  .register()
