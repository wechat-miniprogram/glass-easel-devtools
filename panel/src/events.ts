import { type builder } from 'glass-easel-miniprogram-adapter/dist/glass_easel_miniprogram_adapter'
import { type protocol, setEventHandler } from './message_channel'

export class EventDispatcher<
  N extends string,
  K extends string | number,
  T extends { [k in N]: K },
> {
  private keyName: N
  private listeners = Object.create(null) as { [key: string | number]: ((args: T) => void)[] }

  constructor(keyName: N) {
    this.keyName = keyName
  }

  addListener(key: K, func: (args: T) => void) {
    if (this.listeners[key]) this.listeners[key].push(func)
    else this.listeners[key] = [func]
  }

  removeListener(key: K, func: (args: T) => void) {
    if (this.listeners[key]) this.listeners[key].filter((x) => x !== func)
  }

  bindComponentLifetimes(
    ctx: builder.BuilderContext<any, any, any>,
    getKey: () => K,
    func: (args: T) => void,
  ) {
    const { lifetime } = ctx
    lifetime('attached', () => {
      this.addListener(getKey(), func)
    })
    lifetime('detached', () => {
      this.removeListener(getKey(), func)
    })
  }

  dispatch(args: T) {
    const funcArr = this.listeners[args[this.keyName]]
    funcArr?.forEach((f) => f(args))
  }
}

export const childNodeCountUpdated = new EventDispatcher<
  'nodeId',
  protocol.NodeId,
  protocol.dom.ChildNodeCountUpdated['detail']
>('nodeId')
setEventHandler('DOM.childNodeCountUpdated', (args) => {
  childNodeCountUpdated.dispatch(args)
})

export const setChildNodes = new EventDispatcher<
  'parentId',
  protocol.NodeId,
  protocol.dom.SetChildNodes['detail']
>('parentId')
setEventHandler('DOM.setChildNodes', (args) => {
  setChildNodes.dispatch(args)
})

export const childNodeInserted = new EventDispatcher<
  'parentNodeId',
  protocol.NodeId,
  protocol.dom.ChildNodeInserted['detail']
>('parentNodeId')
setEventHandler('DOM.childNodeInserted', (args) => {
  childNodeInserted.dispatch(args)
})
