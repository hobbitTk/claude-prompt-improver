import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const COMMAND = 'improver'

const isEnabled = atom({ plugin: 'prompt-improver', key: 'isEnabled' } as const, true)

/**
 * What the model reads beside the prompt. The prompt as typed stays the
 * instruction; this block only asks the model to settle its reading first.
 */
const RUBRIC = [
  '[prompt-improver] Before acting on the prompt above, read it against this conversation and settle, silently:',
  '1. Goal: what the user most likely wants, with every "it", "this", "that" and any elided object resolved to the concrete thing already in the conversation.',
  '2. Shape: what they expect back. An answer in chat, a code change, a file, a decision, or a question back to them.',
  '3. Implicit constraints: what they would assume you already know. Project conventions, decisions made earlier in this session, and the language they typed in.',
  '4. Ambiguity: at most one real fork in meaning. If the readings would lead to materially different work, ask instead of guessing.',
  'The prompt as typed is the instruction and wins on any conflict; this note adds no requirement the user did not imply. Reply in the language the prompt was typed in.',
  'Open the reply with one short line, "Reading this as: ...", only when you resolved a pronoun or an elided object, or chose between readings. On a clear prompt, no preamble.',
].join('\n')

/** Prompt origins that are not a person typing. The rubric is for typed prompts only. */
const MACHINE_ORIGINS: ReadonlySet<string> = new Set([
  'plugin',
  'peer',
  'peer-send-message',
  'task-notification',
  'scheduled-trigger',
  'projects-relay',
  'coordinator',
  'observer',
  'observer-activity',
])

const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length

const asCount = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

export const register: Register = (on, options) => {
  const minWords = asCount(options.minWords, 4)
  const maxWords = asCount(options.maxWords, 40)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Toggle the prompt improver for this session: /improver [on|off|status]',
    })

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    const current = await read($, isEnabled)
    const wanted =
      arg === 'on' ? true : arg === 'off' ? false : arg === '' || arg === 'status' ? current : null

    if (wanted === null) {
      return { text: `Usage: /${COMMAND} [on|off|status]` }
    }
    if (wanted !== current) {
      await update($, isEnabled, () => wanted)
    }

    return { text: `Prompt improver is ${wanted ? 'on' : 'off'}.` }
  }).catch(() => ({ text: 'Prompt improver: could not read or change its state.' }))

  on('prompt.submit', async ($, e, next) => {
    // A slash command, a prompt the person never typed, or a machine's delivery: untouched.
    // The origin is always stamped in a session; the test kit may leave it out.
    const origin = e.origin?.kind ?? 'composer'
    if (e.command || e.isMeta || MACHINE_ORIGINS.has(origin)) {
      return next(e)
    }
    if (!(await read($, isEnabled))) {
      return next(e)
    }

    const words = countWords(e.text)
    if (words < minWords || words > maxWords) {
      return next(e)
    }

    return next({ ...e, context: [...(e.context ?? []), RUBRIC] })
  }).catch(($, e, next) => next(e)) // fail open: a broken hook never blocks a prompt
}
