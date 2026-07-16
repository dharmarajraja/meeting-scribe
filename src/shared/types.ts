export interface TranscriptSegment {
  id: string
  speaker: string
  text: string
  startMs: number
  endMs: number
  isFinal: boolean
}

export interface ActionItem {
  task: string
  owner: string
  dueDate: string
  sourceQuote: string
}

export interface MeetingMinutes {
  executiveSummary: string
  keyDecisions: string[]
  actionItems: ActionItem[]
  openQuestions: string[]
  nextSteps: string[]
  generatedAt: string
}

export type RecorderStatus = 'idle' | 'requesting-permissions' | 'recording' | 'stopping' | 'generating-minutes' | 'error'

export interface IpcApi {
  startRecording: () => Promise<{ ok: boolean; error?: string }>
  stopRecording: () => Promise<{ ok: boolean; error?: string }>
  sendAudioChunk: (chunk: ArrayBuffer) => void
  onTranscriptUpdate: (cb: (segment: TranscriptSegment) => void) => () => void
  onStatusChange: (cb: (status: RecorderStatus, message?: string) => void) => () => void
  generateMinutes: (transcript: TranscriptSegment[]) => Promise<{ ok: boolean; minutes?: MeetingMinutes; error?: string }>
  exportTranscript: (transcript: TranscriptSegment[], meetingTitle: string) => Promise<{ ok: boolean; path?: string; error?: string }>
  exportMinutes: (minutes: MeetingMinutes, meetingTitle: string) => Promise<{ ok: boolean; path?: string; error?: string }>
}
