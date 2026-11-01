import { expect, mock, test } from 'claude-code/testing'
import type { On, SessionMeasureInput } from 'claude-code'

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
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  const opened: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  return { submitted, box, files, opened, toasts }
}

const MARKER = `${DATA}/handoff-s1`

/** A main-loop turn ending, after the plugin's Stop hook (ndz-check.js) ran. */
const turnEnds = {
  answer: 'done',
  durationMs: 1,
  isAborted: false,
  turnId: 't1',
  reason: 'answer',
} as const

test('/ndz reports context against the terminal default', async ($, on) => {
  world(on, { NDZ_SURFACE: 'terminal' }, {}, 212000)
  const answer = await $.command.run(run(''))
  expect(answer.text).toBe('212,000 of 900,000 tokens (24%), limit from the default.')
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
    expect(await ui.find({ type: 'Text', text: /NDZ 212k \/ 900k {2}24%/ })).toBeDefined()

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

test('when the handoff turn ends, /clear goes into an empty prompt box', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 920000)
  await $.command.run(run(''))

  // First stop over the limit: ndz-check.js writes the marker and sends Claude off.
  w.files[MARKER] = '920000'
  await $.turn.complete(turnEnds)
  expect(w.box.text).toBe('')
  expect((await $.command.run(run(''))).text).toContain('Handoff in progress.')

  // The handoff turn's stop: ndz-check.js leaves the .done marker.
  w.files[`${MARKER}.done`] = ''
  await $.turn.complete(turnEnds)
  expect(w.box.text).toBe('/clear')
  expect((await $.command.run(run(''))).text).toContain('Handoff written')
})

test('a subagent ending does not count as the handoff turn', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, { [MARKER]: '1', [`${MARKER}.done`]: '' }, 920000)
  await $.turn.complete({ ...turnEnds, agentId: 'a1' })
  expect(w.box.text).toBe('')
})

test('a draft in the prompt box is left alone', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, { [MARKER]: '1', [`${MARKER}.done`]: '' }, 920000)
  w.box.text = 'half a thought'
  await $.turn.complete(turnEnds)
  expect(w.box.text).toBe('half a thought')
})

test('in Cowork the prompt box is never filled', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'cowork' }, { [MARKER]: '1', [`${MARKER}.done`]: '' }, 620000)
  await $.command.run(run(''))
  await $.turn.complete(turnEnds)
  expect(w.box.text).toBe('')
})

const DASH = {
  plugin: 'no-dumb-zone',
  component: 'Pane',
  requestId: 'ndz-dash',
  props: {
    title: 'No Dumb Zone',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** The engine's measure after a turn, at this many tokens. */
function measured(tokens: number): SessionMeasureInput {
  return { context: { tokens, window: 1000000 }, rateLimits: [], changed: ['context'] }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the dashboard shows the gauge, growth per turn and turns left`, async ($, on) => {
    const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 600000)
    expect((await $.command.run(run('dash'))).text).toBe('Dashboard open.')
    expect(w.opened).toEqual(['ndz-dash'])
    for (const t of [600000, 640000, 680000, 720000]) await $.session.measure(measured(t))

    const ui = await $.ui.mount({ ...DASH, surface })
    expect(await ui.find({ type: 'Text', text: /720k \/ 900k\s+80%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\+40k avg/ })).toBeDefined()
    // (900k - 720k) / 40k a turn = 4.5, so about 5 turns.
    expect(await ui.find({ type: 'Text', text: /~5 at this pace/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'clear to work' })).toBeDefined()

    await ui.press({ key: 'ndz-dash-handoff' })
    expect(w.submitted.length).toBe(1)
    await ui.unmount()
  })
}

test('the dashboard opens on its own at 80%, once', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 500000)
  await $.session.measure(measured(500000))
  expect(w.opened).toEqual([])
  await $.session.measure(measured(730000))
  await $.session.measure(measured(760000))
  expect(w.opened).toEqual(['ndz-dash'])
})

test('the limit picker writes the limit file the Stop hook reads', async ($, on) => {
  const w = world(on, { NDZ_SURFACE: 'terminal' }, {}, 300000)
  await $.session.measure(measured(300000))
  const ui = await $.ui.mount({ ...DASH, surface: 'terminal' })
  await ui.select({ key: 'ndz-dash-limit', value: '600000' })
  expect(w.files[`${DATA}/limit`]).toBe('600000\n')
  expect((await $.command.run(run(''))).text).toContain('of 600,000 tokens (50%), limit from the limit file')

  await ui.select({ key: 'ndz-dash-limit', value: 'default' })
  expect(w.files[`${DATA}/limit`]).toBe('')
  expect((await $.command.run(run(''))).text).toContain('limit from the default')
  await ui.unmount()
})
