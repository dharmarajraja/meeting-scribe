import type { MeetingMinutes } from '@shared/types'
import { getIpcApi } from '../lib/ipcApi'

interface Props {
  minutes: MeetingMinutes | null
  meetingTitle: string
  isGenerating: boolean
  canGenerate: boolean
  isBrowserMode: boolean
  onRegenerate: () => void
}

function MinutesTab({ minutes, meetingTitle, isGenerating, canGenerate, isBrowserMode, onRegenerate }: Props): JSX.Element {
  const api = getIpcApi()

  const handleExport = async (): Promise<void> => {
    if (!minutes) return
    const result = await api.exportMinutes(minutes, meetingTitle)
    if (!result.ok && result.error && result.error !== 'Export canceled') {
      alert(`Export failed: ${result.error}`)
    }
  }

  if (isGenerating) {
    return <div className="empty-state">Generating meeting minutes from the transcript…</div>
  }

  if (!minutes) {
    return (
      <div className="empty-state">
        No minutes yet. Minutes are generated automatically when you stop recording.
        {canGenerate && (
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-start" onClick={onRegenerate} disabled={isBrowserMode}>
              Generate Minutes Now
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="minutes-header">
        <div>Generated {new Date(minutes.generatedAt).toLocaleString()}</div>
        <div className="minutes-actions">
          <button className="btn btn-export" onClick={onRegenerate} disabled={isBrowserMode}>
            Regenerate
          </button>
          <button className="btn btn-export" onClick={handleExport} disabled={isBrowserMode}>
            Export .docx
          </button>
        </div>
      </div>

      <section className="minutes-section">
        <h2>Executive Summary</h2>
        <p>{minutes.executiveSummary || 'Not available.'}</p>
      </section>

      <section className="minutes-section">
        <h2>Key Decisions</h2>
        {minutes.keyDecisions.length ? (
          <ul>
            {minutes.keyDecisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </section>

      <section className="minutes-section">
        <h2>Action Items</h2>
        {minutes.actionItems.length ? (
          <table className="action-items-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Owner</th>
                <th>Due Date</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {minutes.actionItems.map((item, i) => (
                <tr key={i}>
                  <td>{item.task}</td>
                  <td>{item.owner}</td>
                  <td>{item.dueDate}</td>
                  <td>
                    <em>"{item.sourceQuote}"</em>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No action items recorded.</p>
        )}
      </section>

      <section className="minutes-section">
        <h2>Open Questions</h2>
        {minutes.openQuestions.length ? (
          <ul>
            {minutes.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </section>

      <section className="minutes-section">
        <h2>Next Steps</h2>
        {minutes.nextSteps.length ? (
          <ul>
            {minutes.nextSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        ) : (
          <p>None recorded.</p>
        )}
      </section>
    </div>
  )
}

export default MinutesTab
