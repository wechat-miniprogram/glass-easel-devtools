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

  dispatch(args: T) {
    const funcArr = this.listeners[args[this.keyName]]
    funcArr?.forEach((f) => f(args))
  }
}

export const registerNodeEventListener = <
  N extends string,
  K extends string | number,
  T extends { [k in N]: K },
>(
  ev: EventDispatcher<N, K, T>,
  ctx: builder.BuilderContext<any, any, any>,
  k: K,
  func: (args: T) => void,
) => {
  const { lifetime } = ctx
  lifetime('attached', () => {
    ev.addListener(k, func)
  })
  lifetime('detached', () => {
    ev.removeListener(k, func)
  })
}

export const childNodeCountUpdated = new EventDispatcher<
  'nodeId',
  protocol.NodeId,
  protocol.dom.ChildNodeCountUpdated['detail']
>('nodeId')
setEventHandler('DOM.childNodeCountUpdated', (args) => {
  childNodeCountUpdated.dispatch(args)
})
