export const enum ExtensionEnv {
  Chrome,
  Firefox,
}

export const EXTENSION_ENV = navigator.userAgent.includes(' Firefox/')
  ? ExtensionEnv.Firefox
  : ExtensionEnv.Chrome

export const inChrome = (): boolean => EXTENSION_ENV === ExtensionEnv.Chrome

export const inFirefox = (): boolean => EXTENSION_ENV === ExtensionEnv.Firefox

export interface DevTools {
  inspector?: InspectorDevTools
}

export interface DevToolsBridge extends DevTools {
  _devToolsConnect(target: DevTools): void
  _devToolsDisconnect(): void
}

export interface InspectorDevTools {
  addMountPoint(root: unknown): void
  removeMountPoint(root: unknown): void
}

export const enum ConnectionSource {
  DevToolsPanel = 'DevToolsPanel',
  ContentScript = 'ContentScript',
}
