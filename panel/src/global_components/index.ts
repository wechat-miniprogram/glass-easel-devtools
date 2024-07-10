import { type glassEasel, type CodeSpace } from 'glass-easel-miniprogram-adapter'
import * as view from './view/view'

const getCompDef = (def: unknown): glassEasel.GeneralComponentDefinition => {
  const d = def as { _$: glassEasel.GeneralComponentDefinition }
  return d._$
}

export const loadGlobalComponents = (codeSpace: CodeSpace) => {
  const space = codeSpace.getComponentSpace()
  space.setGlobalUsingComponent('view', getCompDef(view.componentDefinition))
}
