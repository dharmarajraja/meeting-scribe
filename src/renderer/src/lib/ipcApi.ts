import type { IpcApi } from '@shared/types'

type WindowWithOptionalApi = Window & {
  api?: IpcApi
}

const BROWSER_MODE_MESSAGE =
  'Browser mode: recording, AI minutes generation, and export are only available in the Electron desktop window.'

const browserFallbackApi: IpcApi = {
  startRecording: async () => ({ ok: false, error: BROWSER_MODE_MESSAGE }),
  stopRecording: async () => ({ ok: false, error: BROWSER_MODE_MESSAGE }),
  sendAudioChunk: () => undefined,
  onTranscriptUpdate: () => () => undefined,
  onStatusChange: () => () => undefined,
  generateMinutes: async () => ({ ok: false, error: BROWSER_MODE_MESSAGE }),
  exportTranscript: async () => ({ ok: false, error: BROWSER_MODE_MESSAGE }),
  exportMinutes: async () => ({ ok: false, error: BROWSER_MODE_MESSAGE })
}

export function getIpcApi(): IpcApi {
  const scopedWindow = window as WindowWithOptionalApi
  return scopedWindow.api ?? browserFallbackApi
}

export function isElectronBridgeAvailable(): boolean {
  const scopedWindow = window as WindowWithOptionalApi
  return Boolean(scopedWindow.api)
}

export function getBrowserModeMessage(): string {
  return BROWSER_MODE_MESSAGE
}
