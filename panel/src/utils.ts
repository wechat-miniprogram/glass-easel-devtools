export const error = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.error(`[glass-easel-miniprogram-panel] ${msg}`, ...args)
}

export const warn = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  console.warn(`[glass-easel-miniprogram-panel] ${msg}`, ...args)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const debug = (msg: string, ...args: unknown[]) => {
  // eslint-disable-next-line no-console
  // console.debug(`[glass-easel-miniprogram-panel] ${msg}`, ...args)
}
