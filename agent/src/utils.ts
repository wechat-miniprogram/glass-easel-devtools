export declare const DEV: boolean

export const error = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error(`[glass-easel-miniprogram-agent] ${msg}`, ...args)
}

export const warn = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.warn(`[glass-easel-miniprogram-agent] ${msg}`, ...args)
}

export const debug = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  if (DEV) console.debug(`[glass-easel-miniprogram-agent] ${msg}`, ...args)
}

export const backendUnsupported = (apiName: string) => {
  throw new Error(`"${apiName}" is not supported by the backend`)
}
