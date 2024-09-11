const PRESERVED_RIGHT_WIDTH = 16

Component()
  .property('edit', Boolean)
  .property('value', String)
  .data(() => ({
    width: 0,
    previewValue: '',
  }))
  .init(({ self, data, observer, listener, method }) => {
    observer('edit', (v) => {
      if (v) {
        self.setData({}, () => {
          const editInput = self._$?.getShadowRoot()?.getElementById('edit')?.getBackendElement()
          if (editInput) {
            self._$?.getBackendContext()?.setFocusedNode?.(editInput as any)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            ;(editInput as any).select?.()
          }
        })
      }
    })

    observer(['edit', 'value'], () => {
      updateWidth()
    })

    const getInputValue = () => {
      const editInput = self._$?.getShadowRoot()?.getElementById('edit')?.getBackendElement()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return (editInput as any)?.value as string | undefined
    }

    const startEdit = listener(() => {
      self.setData({ edit: true, width: PRESERVED_RIGHT_WIDTH, previewValue: data.value })
    })

    const inputBlur = listener(() => {
      commit()
    })

    const updateWidth = method(() => {
      if (!data.edit) return
      const previewValue = getInputValue() ?? data.value
      self.setData({ previewValue }, () => {
        self
          .createSelectorQuery()
          .select('#measure')
          .boundingClientRect((rect) => {
            if (!rect) return
            const width =
              rect.width > PRESERVED_RIGHT_WIDTH
                ? rect.width + PRESERVED_RIGHT_WIDTH
                : PRESERVED_RIGHT_WIDTH
            self.setData({ width })
          })
          .exec()
      })
    })

    const commit = method(() => {
      setTimeout(() => {
        const value = getInputValue()
        if (value === undefined) return
        self.setData({ edit: false, value })
        self.triggerEvent('change', { value }, {})
      }, 0)
    })

    return { startEdit, inputBlur, updateWidth, commit }
  })
  .register()
