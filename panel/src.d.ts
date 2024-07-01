import type * as adapter from 'glass-easel-miniprogram-adapter'

export declare const env: adapter.MiniProgramEnv
export declare const codeSpace: adapter.CodeSpace
export declare const registerGlobalEventListener: (
  backend: adapter.glassEasel.GeneralBackendContext,
) => void
export declare const initWithBackend: (
  backend: adapter.glassEasel.GeneralBackendContext,
) => adapter.AssociatedBackend
