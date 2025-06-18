Component()
  .property('edit', Boolean)
  .property('value', String)
  .data(() => ({
    height: 16,
    previewValue: '\n',
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
      updateSize()
    })

    const getInputValue = () => {
      const editInput = self._$?.getShadowRoot()?.getElementById('edit')?.getBackendElement()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return (editInput as any)?.value as string | undefined
    }

    const startEdit = listener(() => {
      self.setData({ edit: true, height: 16, previewValue: `${data.value}\n` })
    })

    const inputBlur = listener(() => {
      commit()
    })

    const updateSize = method(() => {
      if (!data.edit) return
      const previewValue = `${getInputValue() ?? data.value}\n`
      self.setData({ previewValue }, () => {
        self
          .createSelectorQuery()
          .select('#measure')
          .boundingClientRect((rect) => {
            if (!rect) return
            const height = rect.height
            self.setData({ height })
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

    return { startEdit, inputBlur, updateSize, commit }
  })
  .register()
