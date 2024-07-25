Component()
  .options({
    dynamicSlots: true,
  })
  .externalClasses(['hello-class', 'hover-class'])
  .property('hello', String)
  .data(() => ({
    random: 0,
  }))
  .init(({ setData, method }) => {
    const updateRandom = method(() => {
      setData({ random: Math.random() })
    })
    return { updateRandom }
  })
  .register()
