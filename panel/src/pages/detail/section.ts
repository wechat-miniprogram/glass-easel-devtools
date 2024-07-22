Component()
  .property('title', String)
  .property('collapsed', Boolean)
  .init(({ data, setData, listener }) => {
    const toggleBody = listener(() => {
      setData({ collapsed: !data.collapsed })
    })
    return { toggleBody }
  })
  .register()
