import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const DATA = '/data/ndz'
const BAND = {
  plugin: 'no-dumb-zone',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

/** A /ndz typed at the prompt. */
function run(args: string) {
  return {
    command: 'ndz',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 120 },
  } as const
}

/** The world beneath the mod: an environment, a tiny file system, a session. */
function world(on: On, env: Record<string, string>, files: Record<string, string>, tokens: number) {
  const submitted: string[] = []
  const box = { text: '', cursor: 0 }
  mock.env(on, { CLAUDE_PLUGIN_DATA: DATA, ...env })
  on('fs.exists', (_$, e) => ({ value: e.path in files }))
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }))
  on('fs.write', (_$, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('session.id', () => ({ value: 's1' }))
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens, window: 1000000, percent: 0 }, rateLimits: [] },
  }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('prompt.submit', (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('prompt.read', () => ({ value: box }))
  on('prompt.fill', (_$, e) => {
    box.text = e.text
    return { isFilled: true }
  })
  // The plugin's own Stop hook, standing beneath the mod as in a session.
  const stop = { writesMarker: false }
  on('classic.Stop', () => {
    if (stop.writesMarker) files[`${DATA}/handoff-s1`] ??= String(tokens)
    return {}
  })
  return { submitted, box, files, stop }
}

test('/ndz reports context against the terminal default', async ($, on) => {
  world(on, { NDZ_SURFACE: 'terminal' }, {}, 212000)
  const answer = await $.command.run(run(''))
  expect(answer.text).toBe('212,000 of 500,000 tokens (42%), limit from the default.')
})

test('the limit file beats the default, NDZ_LIMIT beats the file, Cowork has its own default', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'cowork' }, {}, 300000)
  expect((await $.command.run(run(''))).text).toContain('of 600,000 tokens (50%), limit from the default')
  w.files[`${DATA}/limit`] = '400000\n'
  expect((await $.command.run(run(''))).text).toContain('of 400,000 tokens (75%), limit from the limit file')
})

test('NDZ_LIMIT wins over the limit file', async ($, on) => {
  world(on, { NDZ_SURFACE: 'terminal', NDZ_LIMIT: '250000' }, { [`${DATA}/limit`]: '400000' }, 100000)
  expect((await $.command.run(run(''))).text).toContain('of 250,000 tokens (40%), limit from NDZ_LIMIT')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the band shows the meter and the button starts one handoff`, async ($, on) => {
    const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 212000)
    await $.command.run(run(''))
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /NDZ 212k \/ 500k {2}42%/ })).toBeDefined()

    await ui.press({ key: 'ndz-handoff' })
    expect(w.submitted.length).toBe(1)
    expect(w.submitted[0]).toContain('/no-dumb-zone:handoff')
    expect(w.submitted[0]).toContain('Surface: terminal.')
    // The marker the Stop hook reads as "handoff done" is written.
    expect(w.files[`${DATA}/handoff-s1`]).toBe('212000')

    // A second ask does not start a second handoff.
    expect((await $.command.run(run('handoff'))).text).toContain('already')
    expect(w.submitted.length).toBe(1)
    await ui.unmount()
  })
}

test('when the handoff turn stops, /clear goes into an empty prompt box', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 520000)
  await $.command.run(run(''))

  // First stop over the limit: the plugin's Stop hook writes the marker.
  w.stop.writesMarker = true
  await $.classic.Stop({ stop_hook_active: false })
  expect(w.box.text).toBe('')
  expect((await $.command.run(run(''))).text).toContain('Handoff in progress.')

  // The handoff turn ends: the marker was already there.
  await $.classic.Stop({ stop_hook_active: true })
  expect(w.box.text).toBe('/clear')
  expect((await $.command.run(run(''))).text).toContain('Handoff written')
})

test('a draft in the prompt box is left alone', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, { [`${DATA}/handoff-s1`]: '1' }, 520000)
  w.box.text = 'half a thought'
  await $.classic.Stop({ stop_hook_active: true })
  expect(w.box.text).toBe('half a thought')
})

test('in Cowork the prompt box is never filled', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'cowork' }, { [`${DATA}/handoff-s1`]: '1' }, 620000)
  await $.command.run(run(''))
  await $.classic.Stop({ stop_hook_active: true })
  expect(w.box.text).toBe('')
})
