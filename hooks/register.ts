// no-dumb-zone mod: a live context meter and a handoff button above the prompt.
//
// The settings hooks in hooks.json stay in charge of the handoff itself
// (scripts/ndz-check.js on Stop fires it past the limit). This module only
// draws and offers shortcuts, so it is safe wherever it loads and the plugin
// works unchanged wherever it does not (Claude Code before 2.1.287, or a
// surface that draws nothing).
//
//   band        NDZ 212k / 500k  42%   [ Handoff now ]
//   /ndz        the same figures as text, for surfaces that draw no band
//   /ndz handoff  what the button does
//   after the handoff is written: puts /clear in an empty prompt box
//
// The limit is resolved exactly as scripts/ndz-common.js resolveLimit() does:
// NDZ_LIMIT, then <data dir>/limit, then the surface default. Keep the two in
// step; scripts are CommonJS run by node, this file is an ES module run by
// Claude Code, so they cannot share code.

import type { EngineInterface, Register } from 'claude-code'

const PLUGIN = 'no-dumb-zone'
const DEFAULT_LIMIT_TERMINAL = 500000
const DEFAULT_LIMIT_COWORK = 600000
const TEST_SIZED_BELOW = 10000

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

  const marker = await markerPath($)
  const hasMarker = marker !== '' && (await $.fs.exists(marker))
  if (!hasMarker) phase = 'idle'
  else if (phase === 'idle') phase = 'done'
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
      argumentHint: '[handoff]',
    })
    tokens = (await $.session.usage()).context.tokens
    await refresh($)
    return next(e)
  })

  // After each turn: the fill moved.
  on('session.measure', async ($, e, next) => {
    tokens = e.context.tokens
    await refresh($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // A /clear keeps this module loaded under a new session id.
  on('session.end', ($, e, next) => {
    tokens = undefined
    phase = 'idle'
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // Wraps the plugin's own Stop hook (scripts/ndz-check.js), which writes the
  // marker the first time it sends Claude off to write the handoff. A marker
  // that was there before this stop means the handoff turn itself just ended.
  on('classic.Stop', async ($, e, next) => {
    if (e.agent_id) return next(e)
    const marker = await markerPath($)
    const hadMarker = marker !== '' && (await $.fs.exists(marker))
    const result = await next(e)
    const hasMarker = marker !== '' && (await $.fs.exists(marker))
    if (hasMarker && !hadMarker) phase = 'writing'
    if (hadMarker && phase !== 'done') {
      phase = 'done'
      await offerClear($)
    }
    $.ui.invalidate('ui.render')
    return result
    // If this hook fails, the plugin's Stop hook must still run.
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'ndz' }, async ($, e) => {
    if (e.args.trim().toLowerCase() === 'handoff') return { text: await startHandoff($) }
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
      ],
    })
  })
}
