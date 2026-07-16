import Anthropic from '@anthropic-ai/sdk'
import type { MeetingMinutes, TranscriptSegment } from '../shared/types'

// Verify this against the current model list in the Anthropic docs
// (https://docs.anthropic.com/en/docs/about-claude/models) before shipping —
// model IDs are versioned and this default may need bumping over time.
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

const SYSTEM_PROMPT = `You are an expert meeting-minutes writer for a business audience.
Given a raw, possibly messy meeting transcript, extract structured minutes.

Respond with ONLY valid JSON (no markdown code fences, no commentary) matching exactly this shape:
{
  "executiveSummary": string (3-5 sentences),
  "keyDecisions": string[] (each a concise decision statement, including who decided if known),
  "actionItems": [{ "task": string, "owner": string, "dueDate": string, "sourceQuote": string }],
  "openQuestions": string[],
  "nextSteps": string[]
}

Rules:
- If an owner or due date is not mentioned, use "Not specified".
- "sourceQuote" should be a short verbatim snippet from the transcript that justifies the action item.
- Keep every item concise and specific — no vague filler like "follow up on things".
- If the transcript has no content for a field, return an empty array (not null).`

function extractJson(raw: string): string {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fencedMatch ? fencedMatch[1] : raw).trim()
}

export async function generateMinutes(transcript: TranscriptSegment[]): Promise<MeetingMinutes> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  }

  const transcriptText = transcript
    .filter((s) => s.isFinal)
    .map((s) => `[${formatTimestamp(s.startMs)}] ${s.speaker}: ${s.text}`)
    .join('\n')

  if (!transcriptText.trim()) {
    throw new Error('Transcript is empty — nothing to summarize.')
  }

  const anthropic = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL

  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Meeting transcript:\n\n${transcriptText}` }]
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : '{}'
  const parsed = JSON.parse(extractJson(raw))

  return {
    executiveSummary: parsed.executiveSummary ?? '',
    keyDecisions: parsed.keyDecisions ?? [],
    actionItems: parsed.actionItems ?? [],
    openQuestions: parsed.openQuestions ?? [],
    nextSteps: parsed.nextSteps ?? [],
    generatedAt: new Date().toISOString()
  }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
