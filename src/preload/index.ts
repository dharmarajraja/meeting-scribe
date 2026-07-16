import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi, TranscriptSegment, MeetingMinutes, RecorderStatus } from '../shared/types'

const api: IpcApi = {
  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  sendAudioChunk: (chunk) => ipcRenderer.send('audio:chunk', chunk),

  onTranscriptUpdate: (cb: (segment: TranscriptSegment) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, segment: TranscriptSegment): void => cb(segment)
    ipcRenderer.on('transcript:update', listener)
    return () => ipcRenderer.removeListener('transcript:update', listener)
  },

  onStatusChange: (cb: (status: RecorderStatus, message?: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: RecorderStatus, message?: string): void =>
      cb(status, message)
    ipcRenderer.on('status:change', listener)
    return () => ipcRenderer.removeListener('status:change', listener)
  },

  generateMinutes: (transcript) => ipcRenderer.invoke('minutes:generate', transcript),
  exportTranscript: (transcript: TranscriptSegment[], meetingTitle: string) =>
    ipcRenderer.invoke('export:transcript', transcript, meetingTitle),
  exportMinutes: (minutes: MeetingMinutes, meetingTitle: string) =>
    ipcRenderer.invoke('export:minutes', minutes, meetingTitle)
}

contextBridge.exposeInMainWorld('api', api)
