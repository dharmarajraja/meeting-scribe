import { useMemo, useState } from 'react'
import type { TranscriptSegment } from '@shared/types'

interface Props {
  segments: TranscriptSegment[]
  interim: TranscriptSegment | null
  meetingTitle: string
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function TranscriptTab({ segments, interim, meetingTitle }: Props): JSX.Element {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return segments
    const q = query.toLowerCase()
    return segments.filter((s) => s.text.toLowerCase().includes(q) || s.speaker.toLowerCase().includes(q))
  }, [segments, query])

  const handleExport = async (): Promise<void> => {
    const result = await window.api.exportTranscript(segments, meetingTitle)
    if (!result.ok && result.error && result.error !== 'Export canceled') {
      alert(`Export failed: ${result.error}`)
    }
  }

  return (
    <div>
      <div className="transcript-toolbar">
        <input
          className="search-input"
          placeholder="Search transcript…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-export" onClick={handleExport} disabled={segments.length === 0}>
          Export .docx
        </button>
      </div>

      {filtered.length === 0 && !interim ? (
        <div className="empty-state">No transcript yet. Start recording to see it appear here live.</div>
      ) : (
        <div>
          {filtered.map((seg) => (
            <div key={seg.id} className="transcript-segment">
              <div className="transcript-timestamp">{formatTimestamp(seg.startMs)}</div>
              <div className="transcript-speaker">{seg.speaker}</div>
              <div className="transcript-text">{seg.text}</div>
            </div>
          ))}
          {interim && (
            <div className="transcript-segment interim">
              <div className="transcript-timestamp">{formatTimestamp(interim.startMs)}</div>
              <div className="transcript-speaker">{interim.speaker}</div>
              <div className="transcript-text">{interim.text}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TranscriptTab
