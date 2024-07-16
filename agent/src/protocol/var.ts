export type GlassEaselVar =
  | { type: 'primitive'; value: string | number | boolean | null | undefined }
  | { type: 'symbol'; value: string }
  | { type: 'function' }
  | { type: 'object' }
  | { type: 'array' }

export const toGlassEaselVar = (v: unknown): GlassEaselVar => {
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v === null ||
    v === undefined
  ) {
    return { type: 'primitive', value: v }
  }
  if (typeof v === 'symbol') {
    return { type: 'symbol', value: v.toString() }
  }
  if (typeof v === 'function') {
    return { type: 'function' }
  }
  if (Array.isArray(v)) {
    return { type: 'array' }
  }
  return { type: 'object' }
}

export const glassEaselVarToString = (v: GlassEaselVar): string => {
  if (v.type === 'primitive') return String(v.value)
  if (v.type === 'symbol') return v.value
  if (v.type === 'function') return '() => {...}'
  if (v.type === 'object') return '{...}'
  if (v.type === 'array') return '[...]'
  return '[unknown]'
}
