import { useCallback, useEffect, useRef, useState } from 'react'
import type { MeetingMinutes, RecorderStatus, TranscriptSegment } from '@shared/types'
import { startAudioSession, type AudioSessionHandle } from './lib/audioMixer'
import { getBrowserModeMessage, getIpcApi, isElectronBridgeAvailable } from './lib/ipcApi'
import TranscriptTab from './components/TranscriptTab'
import MinutesTab from './components/MinutesTab'

type Tab = 'transcript' | 'minutes'

function App(): JSX.Element {
  const api = getIpcApi()
  const isBrowserMode = !isElectronBridgeAvailable()

  const [meetingTitle, setMeetingTitle] = useState('Untitled Meeting')
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [activeTab, setActiveTab] = useState<Tab>('transcript')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [interim, setInterim] = useState<TranscriptSegment | null>(null)
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null)

  const audioSessionRef = useRef<AudioSessionHandle | null>(null)

  useEffect(() => {
    const unsubscribeTranscript = api.onTranscriptUpdate((segment) => {
      if (segment.isFinal) {
        setSegments((prev) => [...prev, segment])
        setInterim(null)
      } else {
        setInterim(segment)
      }
    })

    const unsubscribeStatus = api.onStatusChange((newStatus, message) => {
      setStatus(newStatus)
      setStatusMessage(message)
    })

    return () => {
      unsubscribeTranscript()
      unsubscribeStatus()
    }
  }, [api])

  useEffect(() => {
    return () => {
      audioSessionRef.current?.stop()
      audioSessionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isBrowserMode) {
      setStatusMessage(getBrowserModeMessage())
    }
  }, [isBrowserMode])

  const handleStart = useCallback(async () => {
    if (isBrowserMode) {
      setStatusMessage(getBrowserModeMessage())
      setStatus('idle')
      return
    }

    setStatus('requesting-permissions')
    setStatusMessage(undefined)
    setSegments([])
    setInterim(null)
    setMinutes(null)

    const result = await api.startRecording()
    if (!result.ok) {
      setStatus('error')
      setStatusMessage(result.error)
      return
    }

    try {
      audioSessionRef.current = await startAudioSession((chunk) => api.sendAudioChunk(chunk))
      setStatus('recording')
    } catch (err) {
      setStatus('error')
      setStatusMessage(err instanceof Error ? err.message : 'Microphone/audio permission denied.')
    }
  }, [api, isBrowserMode])

  const handleStop = useCallback(async () => {
    setStatus('stopping')
    audioSessionRef.current?.stop()
    audioSessionRef.current = null
    await api.stopRecording()

    setStatus('generating-minutes')
    const result = await api.generateMinutes(segments)
    if (result.ok && result.minutes) {
      setMinutes(result.minutes)
      setActiveTab('minutes')
      setStatus('idle')
    } else {
      setStatus('error')
      setStatusMessage(result.error)
    }
  }, [api, segments])

  const handleRegenerateMinutes = useCallback(async () => {
    if (isBrowserMode) {
      setStatusMessage(getBrowserModeMessage())
      setStatus('idle')
      return
    }

    setStatus('generating-minutes')
    const result = await api.generateMinutes(segments)
    if (result.ok && result.minutes) {
      setMinutes(result.minutes)
      setStatus('idle')
    } else {
      setStatus('error')
      setStatusMessage(result.error)
    }
  }, [api, isBrowserMode, segments])

  const isRecording = status === 'recording' || status === 'requesting-permissions'

  return (
    <div className="app">
      <header className="topbar">
        <input
          className="meeting-title-input"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="Meeting title"
        />
        <div className="status-pill" data-status={status}>
          {statusLabel(status)}
        </div>
        {isRecording ? (
          <button className="btn btn-stop" onClick={handleStop} disabled={status === 'requesting-permissions'}>
            ● Stop Recording
          </button>
        ) : (
          <button className="btn btn-start" onClick={handleStart} disabled={status === 'generating-minutes' || isBrowserMode}>
            ● Start Recording
          </button>
        )}
      </header>

      {statusMessage && status === 'error' && <div className="error-banner">{statusMessage}</div>}
      {statusMessage && isBrowserMode && <div className="info-banner">{statusMessage}</div>}

      <nav className="tabbar">
        <button
          className={`tab ${activeTab === 'transcript' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button className={`tab ${activeTab === 'minutes' ? 'tab-active' : ''}`} onClick={() => setActiveTab('minutes')}>
          Meeting Minutes
        </button>
      </nav>

      <main className="content">
        {activeTab === 'transcript' ? (
          <TranscriptTab segments={segments} interim={interim} meetingTitle={meetingTitle} isBrowserMode={isBrowserMode} />
        ) : (
          <MinutesTab
            minutes={minutes}
            meetingTitle={meetingTitle}
            isGenerating={status === 'generating-minutes'}
            canGenerate={segments.length > 0}
            isBrowserMode={isBrowserMode}
            onRegenerate={handleRegenerateMinutes}
          />
        )}
      </main>
    </div>
  )
}

function statusLabel(status: RecorderStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'requesting-permissions':
      return 'Requesting mic/audio access…'
    case 'recording':
      return 'Recording'
    case 'stopping':
      return 'Stopping…'
    case 'generating-minutes':
      return 'Generating minutes…'
    case 'error':
      return 'Error'
    default:
      return status
  }
}

export default App
