// no-dumb-zone mod: a live context meter and a handoff button above the prompt.
//
// The settings hooks in hooks.json stay in charge of the handoff itself
// (scripts/ndz-check.js on Stop fires it past the limit). This module only
// draws and offers shortcuts, so it is safe wherever it loads and the plugin
// works unchanged wherever it does not (Claude Code before 2.1.287, or a
// surface that draws nothing).
//
//   band        NDZ 212k / 900k  24%   [ Handoff now ]
//   /ndz        the same figures as text, for surfaces that draw no band
//   /ndz handoff  what the button does
//   /ndz dash   the dashboard pane: gauge, growth per turn, turns left,
//               status, Handoff now, a limit picker (opens itself at 80%)
//   after the handoff is written: puts /clear in an empty prompt box
//   (scripts/ndz-check.js leaves handoff-<id>.done at the stop that ends it)
//
// The limit is resolved exactly as scripts/ndz-common.js resolveLimit() does:
// NDZ_LIMIT, then <data dir>/limit, then the surface default. Keep the two in
// step; scripts are CommonJS run by node, this file is an ES module run by
// Claude Code, so they cannot share code.

import type { EngineInterface, Register } from 'claude-code'

const PLUGIN = 'no-dumb-zone'
const DEFAULT_LIMIT_TERMINAL = 900000
const DEFAULT_LIMIT_COWORK = 600000
const TEST_SIZED_BELOW = 10000
const PANE = 'ndz-dash'
const SPARK = '▁▂▃▄▅▆▇█'
const LIMIT_CHOICES = [300000, 500000, 600000, 750000, 900000]
const HISTORY_KEPT = 40

type Source = 'env' | 'file' | 'default'
type Phase = 'idle' | 'writing' | 'done'

// What the band draws from. Module variables are lost on a reload, and that is
// fine: session.start fires again and measures afresh.
let tokens: number | undefined
let limit = DEFAULT_LIMIT_TERMINAL
let source: Source = 'default'
let phase: Phase = 'idle'
let isCowork = false
let dir = ''
let filledFor = ''
// Context after each turn, oldest first: what the growth line and the
// turns-left estimate are drawn from. Starts over on a reload and on /clear.
let history: number[] = []
let openedFor = ''

function positiveInt(s: string | undefined): number {
  const n = parseInt(String(s ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Where the hooks keep the limit file and the handoff markers. Hook scripts
 *  get it as CLAUDE_PLUGIN_DATA; this process may not, so it is rebuilt the
 *  way Claude Code names it: <config dir>/plugins/data/<plugin id, @ as ->. */
function dataDirFrom(
  root: string,
  pluginData: string | undefined,
  configDir: string | undefined,
  home: string | undefined,
): string {
  if (pluginData) return pluginData.replace(/\\/g, '/')
  const r = root.replace(/\\/g, '/')
  const cached = /\/plugins\/cache\/([^/]+)\//.exec(r)
  let id = `${PLUGIN}-inline`
  if (/\/plugins\/synced\//.test(r)) id = `${PLUGIN}-synced`
  else if (cached) id = `${PLUGIN}-${cached[1]!.replace(/[^A-Za-z0-9_-]/g, '-')}`
  const base = configDir || (home ? `${home.replace(/[\\/]+$/, '')}/.claude` : '')
  return base ? `${base.replace(/\\/g, '/')}/plugins/data/${id}` : ''
}

function short(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

function percent(): number {
  return tokens === undefined ? 0 : Math.round((tokens / limit) * 100)
}

async function markerPath($: EngineInterface): Promise<string> {
  return dir ? `${dir}/handoff-${await $.session.id()}` : ''
}

/** Re-reads everything the band shows except the token count. */
async function refresh($: EngineInterface): Promise<void> {
  const forced = ((await $.env.get('NDZ_SURFACE')) ?? '').toLowerCase()
  isCowork = forced ? forced === 'cowork' : (await $.env.get('CLAUDE_CODE_ENTRYPOINT')) === 'remote_cowork'

  dir = dataDirFrom(
    $.plugin.root,
    await $.env.get('CLAUDE_PLUGIN_DATA'),
    await $.env.get('CLAUDE_CONFIG_DIR'),
    (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')),
  )

  const fromEnv = positiveInt(await $.env.get('NDZ_LIMIT'))
  let fromFile = 0
  if (dir && (await $.fs.exists(`${dir}/limit`))) {
    fromFile = positiveInt(await $.fs.read(`${dir}/limit`))
  }
  if (fromEnv) {
    limit = fromEnv
    source = 'env'
  } else if (fromFile) {
    limit = fromFile
    source = 'file'
  } else {
    limit = isCowork ? DEFAULT_LIMIT_COWORK : DEFAULT_LIMIT_TERMINAL
    source = 'default'
  }

  // handoff-<id> means a handoff was started; handoff-<id>.done, written by
  // scripts/ndz-check.js at the stop that ends the handoff turn, means it is written.
  const marker = await markerPath($)
  const hasMarker = marker !== '' && (await $.fs.exists(marker))
  const isWritten = hasMarker && (await $.fs.exists(`${marker}.done`))
  if (!hasMarker) phase = 'idle'
  else if (isWritten) phase = 'done'
  else phase = 'writing'
}

/** Once the handoff is written, offers /clear (once per session); opens the
 *  dashboard on its own the first time a session reaches 80%. */
async function afterTurn($: EngineInterface): Promise<void> {
  await refresh($)
  if (phase === 'done') await offerClear($)
  if (percent() >= 80 && !isCowork) {
    const id = await $.session.id()
    if (openedFor !== id) {
      openedFor = id
      await openDash($)
    }
  }
  $.ui.invalidate('ui.render')
}

function statusLine(): string {
  const where = { env: 'NDZ_LIMIT', file: 'the limit file', default: 'the default' }[source]
  const cap = limit.toLocaleString('en-US')
  const fill =
    tokens === undefined
      ? `context not measured yet (no turn has run), limit ${cap} tokens`
      : `${tokens.toLocaleString('en-US')} of ${cap} tokens (${percent()}%), limit`
  const state = { idle: '', writing: ' Handoff in progress.', done: ' Handoff written: start fresh.' }[phase]
  return `${fill} from ${where}.${state}`
}

/** The same request the Stop hook makes, sent on the person's say-so. */
async function startHandoff($: EngineInterface): Promise<string> {
  if (phase !== 'idle') return 'The handoff for this session is already written or under way.'
  await refresh($)
  const marker = await markerPath($)
  // The Stop hook reads this marker as "handoff done": it will remind, not re-run.
  if (marker) await $.fs.write(marker, String(tokens ?? 0))
  phase = 'writing'
  $.ui.invalidate('ui.render')

  const carry =
    isCowork && source === 'file' && limit >= TEST_SIZED_BELOW
      ? ` Limit carry-over: this task's limit was set with /no-dumb-zone:limit, so end the second line of the handoff with " Then /no-dumb-zone:limit ${limit}." and the next task keeps it.`
      : ''
  await $.prompt.submit({
    text:
      'NO DUMB ZONE: handoff requested. Do not start anything new. ' +
      'Run the /no-dumb-zone:handoff skill now, follow it exactly, then stop. ' +
      (isCowork
        ? "Surface: Cowork. The project folder is a connected folder on the user's computer, " +
          'not in this workspace: write NOTES.md and CLAUDE.md there and commit there.' +
          carry
        : 'Surface: terminal.'),
  })
  return 'Handoff started.'
}

/** Context added by each recent turn; a compaction's drop counts as 0. */
function growth(): number[] {
  const out: number[] = []
  for (let i = 1; i < history.length; i++) out.push(Math.max(0, history[i]! - history[i - 1]!))
  return out.slice(-16)
}

/** Average of the last five turns that added context, or 0 before there are any. */
function averageGrowth(): number {
  const recent = growth().filter(d => d > 0).slice(-5)
  return recent.length === 0 ? 0 : Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
}

function turnsLeft(): number | undefined {
  const avg = averageGrowth()
  if (tokens === undefined || avg === 0) return undefined
  return Math.max(0, Math.ceil((limit - tokens) / avg))
}

function gauge(width: number): string {
  const cells = Math.max(10, width)
  const filled = Math.min(cells, Math.round(((tokens ?? 0) / limit) * cells))
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

function sparkline(deltas: number[]): string {
  const top = Math.max(...deltas, 1)
  return deltas.map(d => SPARK[Math.min(7, Math.round((d / top) * 7))]).join('')
}

function meterColor(): 'error' | 'warning' | undefined {
  const pct = percent()
  return pct >= 100 ? 'error' : pct >= 80 ? 'warning' : undefined
}

async function openDash($: EngineInterface): Promise<string> {
  const opened = await $.ui.open({ id: PANE, title: 'No Dumb Zone' })
  return opened.isPlaced ? 'Dashboard open.' : 'Dashboard is waiting for a wider window.'
}

/** Writes the limit file the Stop hook reads; '' means back to the default. */
async function pickLimit($: EngineInterface, value: string): Promise<void> {
  if (!dir) return
  await $.fs.write(`${dir}/limit`, value === 'default' ? '' : `${value}\n`)
  await refresh($)
  $.ui.toast(
    value === 'default'
      ? `no-dumb-zone: limit back to the default, ${limit.toLocaleString('en-US')}`
      : `no-dumb-zone: limit set to ${limit.toLocaleString('en-US')} from the next stop on`,
  )
  $.ui.invalidate('ui.render')
}

/** Puts /clear in the prompt box, once per session, and only into an empty box. */
async function offerClear($: EngineInterface): Promise<void> {
  if (isCowork) return
  const id = await $.session.id()
  if (filledFor === id) return
  filledFor = id
  if ((await $.prompt.read()).text.trim() !== '') return
  await $.prompt.fill({ text: '/clear' })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ndz',
      description: 'no-dumb-zone: show context against the handoff limit',
      argumentHint: '[handoff | dash]',
    })
    tokens = (await $.session.usage()).context.tokens
    await refresh($)
    return next(e)
  })

  // After each turn: the fill moved.
  on('session.measure', async ($, e, next) => {
    tokens = e.context.tokens
    if (tokens !== undefined && history.at(-1) !== tokens) history = [...history, tokens].slice(-HISTORY_KEPT)
    await afterTurn($)
    return next(e)
  })

  // A /clear keeps this module loaded under a new session id.
  on('session.end', ($, e, next) => {
    tokens = undefined
    history = []
    phase = 'idle'
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // When a turn ends, scripts/ndz-check.js (the plugin's Stop hook) has already
  // run and, if this was the handoff turn, left handoff-<id>.done. This used to
  // wrap classic.Stop, but cc-plugin-sec-default skips installed plugins' hooks
  // on classic.Stop on managed, Team and Enterprise setups, so the mod reads the
  // marker files instead. session.measure checks too, whichever comes last wins.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) await afterTurn($)
    return result
    // If this hook fails, the turn still ends normally.
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'ndz' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'handoff') return { text: await startHandoff($) }
    if (arg === 'dash' || arg === 'dashboard') return { text: await openDash($) }
    tokens = (await $.session.usage()).context.tokens
    await refresh($)
    return { text: statusLine() }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || tokens === undefined) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const pct = percent()
    const meter = `NDZ ${short(tokens)} / ${short(limit)}  ${pct}%`

    if (phase === 'done') {
      return Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ color: 'warning', children: [`${meter}  handoff written`] }),
          Button({
            key: 'ndz-clear',
            label: 'Put /clear in the prompt',
            onPress: async () => {
              await $.prompt.fill({ text: '/clear' })
            },
          }),
        ],
      })
    }

    if (phase === 'writing') {
      return Text({ color: 'warning', children: [`${meter}  writing handoff…`] })
    }

    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        pct >= 80
          ? Text({ color: pct >= 100 ? 'error' : 'warning', children: [meter] })
          : Text({ dimColor: true, children: [meter] }),
        Button({
          key: 'ndz-handoff',
          label: 'Handoff now',
          onPress: async () => {
            await startHandoff($)
          },
        }),
        Button({
          key: 'ndz-dash-open',
          label: 'Dashboard',
          dimColor: true,
          onPress: async () => {
            await openDash($)
          },
        }),
      ],
    })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // The mobile app draws no Select yet; there the limit is shown, not picked.
    const Select = 'Select' in els ? els.Select : undefined
    const width = Math.max(20, e.props.bodyColumns - 2)
    const color = meterColor()

    if (tokens === undefined) {
      return Box({
        flexDirection: 'column',
        children: [Text({ dimColor: true, children: ['No turn has run yet. The gauge fills after the first one.'] })],
      })
    }

    const head = `${short(tokens)} / ${short(limit)}`
    const pct = `${percent()}%`
    const gap = ' '.repeat(Math.max(1, width - head.length - pct.length))
    const deltas = growth()
    const avg = averageGrowth()
    const left = turnsLeft()
    const where = { env: 'NDZ_LIMIT', file: 'limit file', default: 'default' }[source]

    const status =
      phase === 'done'
        ? Text({ color: 'success', children: ['handoff written: /clear to start fresh'] })
        : phase === 'writing'
          ? Text({ color: 'warning', children: ['writing the handoff…'] })
          : percent() >= 100
            ? Text({ color: 'error', children: ['past the limit: handoff at the next stop'] })
            : Text({ children: ['clear to work'] })

    const options = LIMIT_CHOICES.includes(limit) || source === 'default'
      ? LIMIT_CHOICES
      : [...LIMIT_CHOICES, limit].sort((a, b) => a - b)

    return Box({
      flexDirection: 'column',
      rowGap: 1,
      children: [
        Box({
          flexDirection: 'column',
          children: [
            Text({ bold: true, ...(color ? { color } : {}), children: [`${head}${gap}${pct}`] }),
            Text({ ...(color ? { color } : {}), children: [gauge(width)] }),
            Text({ dimColor: true, children: [`limit from the ${where}`] }),
          ],
        }),
        Box({
          flexDirection: 'column',
          children: [
            deltas.length > 0
              ? Text({ children: [`per turn  ${sparkline(deltas)}  +${short(avg)} avg`] })
              : Text({ dimColor: true, children: ['per turn  (fills in after a couple of turns)'] }),
            Text({
              ...(left !== undefined && left <= 3 ? { color: 'warning' } : {}),
              children: [
                left === undefined
                  ? 'turns left  not enough turns to guess yet'
                  : left === 0
                    ? 'turns left  none: this is the one'
                    : `turns left  ~${left} at this pace`,
              ],
            }),
            Box({ flexDirection: 'row', columnGap: 1, children: [Text({ children: ['status    '] }), status] }),
          ],
        }),
        Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            phase === 'done'
              ? Button({
                  key: 'ndz-dash-clear',
                  label: 'Put /clear in the prompt',
                  variant: 'primary',
                  onPress: async () => {
                    await $.prompt.fill({ text: '/clear' })
                  },
                })
              : Button({
                  key: 'ndz-dash-handoff',
                  label: phase === 'writing' ? 'Handoff under way' : 'Handoff now',
                  variant: 'primary',
                  hotkey: 'h',
                  onPress: async () => {
                    await startHandoff($)
                  },
                }),
            source === 'env' || !Select
              ? Text({ dimColor: true, children: [`limit ${short(limit)}${source === 'env' ? ', pinned by NDZ_LIMIT' : ''}`] })
              : Select({
                  key: 'ndz-dash-limit',
                  label: 'Limit',
                  value: source === 'default' ? 'default' : String(limit),
                  options: [
                    { value: 'default', label: `default (${short(isCowork ? DEFAULT_LIMIT_COWORK : DEFAULT_LIMIT_TERMINAL)})` },
                    ...options.map(n => ({ value: String(n), label: short(n) })),
                  ],
                  onSelect: (value: string) => {
                    void pickLimit($, value)
                  },
                }),
          ],
        }),
      ],
    })
  })
}
