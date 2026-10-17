import { describe, expect, test } from 'claude-code/testing'
import type { On, PromptSubmitInput } from 'claude-code'

const RUBRIC_TAG = '[prompt-improver]'

const hasRubric = (context: readonly string[] | undefined): boolean =>
  (context ?? []).some(block => block.startsWith(RUBRIC_TAG))

/** A prompt as the person's Enter submits it. */
const typed = (text: string, context?: readonly string[]): PromptSubmitInput => ({
  text,
  wait: false,
  origin: { kind: 'composer' },
  ...(context ? { context } : {}),
})

/** The command as the person types it at the prompt. */
const command = (args: string) => ({
  command: 'improver',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: false, columns: 80 },
})

/** Records the context the engine's bottom sees for the last submission. */
const watch = (on: On) => {
  const seen: { context?: readonly string[] } = {}
  on('prompt.submit', (_, e) => {
    seen.context = e.context
    return { text: e.text }
  })
  return seen
}

describe('prompt-improver', () => {
  test('attaches the rubric beside a short typed prompt', async ($, on) => {
    const seen = watch(on)

    const result = await $.prompt.submit(typed('what does it actually do here'))

    expect(result.drop).toBeUndefined()
    expect(result.text).toBe('what does it actually do here')
    expect(hasRubric(seen.context)).toBe(true)
  })

  test('leaves an acknowledgement alone', async ($, on) => {
    const seen = watch(on)

    await $.prompt.submit(typed('ok'))

    expect(hasRubric(seen.context)).toBe(false)
  })

  test('leaves a long, explicit prompt alone', async ($, on) => {
    const seen = watch(on)
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')

    await $.prompt.submit(typed(long))

    expect(hasRubric(seen.context)).toBe(false)
  })

  test('leaves a prompt a plugin submitted alone', async ($, on) => {
    const seen = watch(on)

    await $.prompt.submit({ ...typed('what does it actually do here'), origin: { kind: 'plugin', name: 'other' } })

    expect(hasRubric(seen.context)).toBe(false)
  })

  test('keeps context other hooks already attached, rubric last', async ($, on) => {
    const seen = watch(on)

    await $.prompt.submit(typed('make this one nicer please', ['earlier note']))

    expect(seen.context?.[0]).toBe('earlier note')
    expect(seen.context?.length).toBe(2)
    expect(hasRubric(seen.context)).toBe(true)
  })

  test('honours the configured word window', { options: { minWords: 1, maxWords: 2 } }, async ($, on) => {
    const seen = watch(on)

    await $.prompt.submit(typed('fix it'))
    expect(hasRubric(seen.context)).toBe(true)

    await $.prompt.submit(typed('fix it now please'))
    expect(hasRubric(seen.context)).toBe(false)
  })

  test('/improver off stops it and /improver on restores it', async ($, on) => {
    const seen = watch(on)

    const off = await $.command.run(command('off'))
    expect(off.text).toBe('Prompt improver is off.')
    await $.prompt.submit(typed('what does it actually do here'))
    expect(hasRubric(seen.context)).toBe(false)

    const status = await $.command.run(command('status'))
    expect(status.text).toBe('Prompt improver is off.')

    const on_ = await $.command.run(command('on'))
    expect(on_.text).toBe('Prompt improver is on.')
    await $.prompt.submit(typed('what does it actually do here'))
    expect(hasRubric(seen.context)).toBe(true)
  })

  test('/improver with junk explains itself', async $ => {
    const reply = await $.command.run(command('maybe'))
    expect(reply.text).toBe('Usage: /improver [on|off|status]')
  })
})
