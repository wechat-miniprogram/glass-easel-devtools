Component()
  .data(() => ({
    class: 'my-class-0',
    paddingLeft: 0,
    arrayData: ['a', 'b', 'c'],
    objectData: { a: 0, b: 1 } as Record<string, number>,
    childList: [1, 2, 3],
  }))
  .init(({ self, data, setData, listener }) => {
    const modifyClass = listener(() => {
      setData({ class: `my-class-${Math.floor(Math.random() * 10)}` })
    })

    const modifyStyle = listener(() => {
      setData({ paddingLeft: Math.floor(Math.random() * 20) })
    })

    const randomArray = () =>
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].slice(0, Math.floor(Math.random() * 7))
    const modifyArrayData = listener(() => {
      setData({
        arrayData: randomArray(),
      })
    })

    const randomObject = () => {
      const ret = {}
      randomArray().forEach((item, index) => {
        Object.assign(ret, { item: index })
      })
      return ret
    }
    const modifyObjectData = listener(() => {
      setData({
        objectData: randomObject(),
      })
    })

    let inc = data.childList.length + 1
    const modifyChildList = listener(() => {
      const list = data.childList.slice()
      const i = Math.floor(Math.random() * (list.length * 2 + 1))
      if (i < list.length) {
        list.splice(i, 1)
      } else {
        list.splice(i - list.length, 0, inc)
        inc += 1
      }
      self.setData({ childList: list })
    })

    return { modifyClass, modifyStyle, modifyArrayData, modifyObjectData, modifyChildList }
  })
  .register()
