Component()
  .property('title', String)
  .property('collapsed', Boolean)
  .property('showRefresh', Boolean)
  .init(({ self, data, setData, listener }) => {
    const toggleBody = listener(() => {
      setData({ collapsed: !data.collapsed })
      if (!data.collapsed) {
        self.triggerEvent('refresh', null, {})
      }
    })
    const refresh = listener(() => {
      self.triggerEvent('refresh', null, {})
    })
    return { toggleBody, refresh }
  })
  .register()
