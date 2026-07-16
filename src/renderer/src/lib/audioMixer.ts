export interface AudioSessionHandle {
  stop: () => void
}

const TIMESLICE_MS = 250

/**
 * Captures the microphone and system/meeting audio (via Electron's loopback
 * getDisplayMedia handler), mixes them into a single stream through the Web
 * Audio API, and streams WebM/Opus chunks to the main process for Deepgram.
 *
 * Mixing into one stream (rather than sending two separate streams) lets
 * Deepgram's diarization work across both the local speaker and remote
 * meeting participants in one pass.
 */
export async function startAudioSession(onChunk: (chunk: ArrayBuffer) => void): Promise<AudioSessionHandle> {
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

  let systemStream: MediaStream | null = null
  try {
    systemStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    // We only need the audio track; drop the video track immediately.
    systemStream.getVideoTracks().forEach((track) => track.stop())
  } catch {
    // User declined system-audio sharing (or it's unavailable on this platform).
    // Fall back to mic-only — still useful for solo note-taking / dictation.
    systemStream = null
  }

  const audioContext = new AudioContext()
  const destination = audioContext.createMediaStreamDestination()

  const micSource = audioContext.createMediaStreamSource(micStream)
  micSource.connect(destination)

  let systemSource: MediaStreamAudioSourceNode | null = null
  if (systemStream && systemStream.getAudioTracks().length > 0) {
    systemSource = audioContext.createMediaStreamSource(systemStream)
    systemSource.connect(destination)
  }

  const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' })

  recorder.ondataavailable = async (event: BlobEvent) => {
    if (event.data.size === 0) return
    const buffer = await event.data.arrayBuffer()
    onChunk(buffer)
  }

  recorder.start(TIMESLICE_MS)

  return {
    stop: () => {
      recorder.stop()
      micStream.getTracks().forEach((track) => track.stop())
      systemStream?.getTracks().forEach((track) => track.stop())
      micSource.disconnect()
      systemSource?.disconnect()
      void audioContext.close()
    }
  }
}
