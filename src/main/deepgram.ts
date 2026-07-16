import { createClient, LiveTranscriptionEvents, type LiveClient } from '@deepgram/sdk'
import { randomUUID } from 'crypto'
import type { TranscriptSegment } from '../shared/types'

type TranscriptCallback = (segment: TranscriptSegment) => void
type StatusCallback = (status: 'recording' | 'error', message?: string) => void

let liveConnection: LiveClient | null = null

export function startDeepgramStream(onTranscript: TranscriptCallback, onStatus: StatusCallback): void {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    onStatus('error', 'DEEPGRAM_API_KEY is not set. Add it to your .env file.')
    return
  }

  const deepgram = createClient(apiKey)

  // No `encoding`/`sample_rate` set here on purpose: the renderer streams
  // containerized audio (WebM/Opus via MediaRecorder), and Deepgram
  // auto-detects the container format for live streaming.
  liveConnection = deepgram.listen.live({
    model: 'nova-2',
    smart_format: true,
    diarize: true,
    interim_results: true,
    punctuate: true
  })

  liveConnection.on(LiveTranscriptionEvents.Open, () => {
    onStatus('recording')
  })

  liveConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0]
    if (!alt || !alt.transcript) return

    const speakerId = alt.words?.[0]?.speaker
    const speaker = speakerId != null ? `Speaker ${speakerId + 1}` : 'Speaker'

    const segment: TranscriptSegment = {
      id: randomUUID(),
      speaker,
      text: alt.transcript,
      startMs: Math.round((data.start ?? 0) * 1000),
      endMs: Math.round(((data.start ?? 0) + (data.duration ?? 0)) * 1000),
      isFinal: Boolean(data.is_final)
    }
    onTranscript(segment)
  })

  liveConnection.on(LiveTranscriptionEvents.Error, (err) => {
    onStatus('error', err instanceof Error ? err.message : String(err))
  })

  liveConnection.on(LiveTranscriptionEvents.Close, () => {
    liveConnection = null
  })
}

export function sendAudioChunk(chunk: Buffer): void {
  if (liveConnection && liveConnection.getReadyState() === 1) {
    const arrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer
    liveConnection.send(arrayBuffer)
  }
}

export function stopDeepgramStream(): void {
  if (liveConnection) {
    liveConnection.requestClose()
    liveConnection = null
  }
}
