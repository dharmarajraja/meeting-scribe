import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType
} from 'docx'
import type { MeetingMinutes, TranscriptSegment } from '../shared/types'

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export async function exportTranscriptToDocx(
  transcript: TranscriptSegment[],
  meetingTitle: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Transcript',
    defaultPath: `${meetingTitle || 'Meeting'} - Transcript.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Export canceled' }

  const paragraphs = [
    new Paragraph({ text: meetingTitle || 'Meeting Transcript', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Generated ${new Date().toLocaleString()}`, spacing: { after: 300 } })
  ]

  for (const seg of transcript.filter((s) => s.isFinal)) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `[${formatTimestamp(seg.startMs)}] `, color: '888888' }),
          new TextRun({ text: `${seg.speaker}: `, bold: true }),
          new TextRun({ text: seg.text })
        ],
        spacing: { after: 120 }
      })
    )
  }

  const doc = new Document({ sections: [{ children: paragraphs }] })
  const buffer = await Packer.toBuffer(doc)
  await writeFile(filePath, buffer)
  return { ok: true, path: filePath }
}

export async function exportMinutesToDocx(
  minutes: MeetingMinutes,
  meetingTitle: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const { filePath, canceled } = await dialog.showSaveDialog({
    title: 'Export Meeting Minutes',
    defaultPath: `${meetingTitle || 'Meeting'} - Minutes.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }]
  })
  if (canceled || !filePath) return { ok: false, error: 'Export canceled' }

  const bulletList = (items: string[]): Paragraph[] =>
    items.length
      ? items.map((item) => new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 80 } }))
      : [new Paragraph({ text: 'None recorded.', spacing: { after: 80 } })]

  const actionItemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: ['Task', 'Owner', 'Due Date', 'Source'].map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })]
            })
        )
      }),
      ...(minutes.actionItems.length
        ? minutes.actionItems.map(
            (item) =>
              new TableRow({
                children: [item.task, item.owner, item.dueDate, item.sourceQuote].map(
                  (val) => new TableCell({ children: [new Paragraph(val)] })
                )
              })
          )
        : [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph('No action items recorded.')] }),
                new TableCell({ children: [new Paragraph('')] }),
                new TableCell({ children: [new Paragraph('')] }),
                new TableCell({ children: [new Paragraph('')] })
              ]
            })
          ])
    ]
  })

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: meetingTitle || 'Meeting Minutes', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: `Generated ${new Date(minutes.generatedAt).toLocaleString()}`, spacing: { after: 300 } }),

          new Paragraph({ text: 'Executive Summary', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ text: minutes.executiveSummary || 'Not available.', spacing: { after: 300 } }),

          new Paragraph({ text: 'Key Decisions', heading: HeadingLevel.HEADING_2 }),
          ...bulletList(minutes.keyDecisions),
          new Paragraph({ text: '', spacing: { after: 200 } }),

          new Paragraph({ text: 'Action Items', heading: HeadingLevel.HEADING_2 }),
          actionItemsTable,
          new Paragraph({ text: '', spacing: { after: 200 } }),

          new Paragraph({ text: 'Open Questions', heading: HeadingLevel.HEADING_2 }),
          ...bulletList(minutes.openQuestions),
          new Paragraph({ text: '', spacing: { after: 200 } }),

          new Paragraph({ text: 'Next Steps', heading: HeadingLevel.HEADING_2 }),
          ...bulletList(minutes.nextSteps)
        ]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  await writeFile(filePath, buffer)
  return { ok: true, path: filePath }
}
