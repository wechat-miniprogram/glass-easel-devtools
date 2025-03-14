import type {
  PageConstructor,
  ComponentConstructor,
  BehaviorConstructor,
} from 'glass-easel-miniprogram-adapter'

declare global {
  const Page: PageConstructor
  const Component: ComponentConstructor
  const Behavior: BehaviorConstructor
}
