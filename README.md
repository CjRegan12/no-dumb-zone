# no-dumb-zone

A Claude Code plugin that hands off and clears before context gets dumb.

Long sessions compacted over and over lose the constraints you stated early, and Claude gets worse as the context window fills. The fix everyone knows and nobody does by hand: keep state in files, `/clear` between tasks. This plugin does it for you.

## What it does

1. Every time Claude finishes a turn, a `Stop` hook reads the session transcript and checks the live context size.
2. Past the limit (default 500k tokens in the terminal, 600k in Cowork, see below), the hook blocks the stop once and tells Claude to run `/no-dumb-zone:handoff`.
3. The handoff skill updates `CLAUDE.md` with durable learnings, writes `NOTES.md` with task state and next steps, commits, and tells you how to start fresh (`/clear` in the terminal, a new task in Cowork).
4. On your first prompt in the fresh session, a `UserPromptSubmit` hook briefs Claude from `NOTES.md`. In the terminal it also names the session from the file's first line. You continue where you left off at ~20k tokens instead of 500k.

It never interrupts a task. `Stop` only fires when Claude has stopped on its own, so a task in progress always finishes first.

## The meter (terminal and desktop Code tab, Claude Code 2.1.287+)

On Claude Code 2.1.287 or later the plugin also loads a small [mod](https://code.claude.com/docs/en/plugins/mods/overview), `hooks/register.ts`. It changes nothing about when the handoff fires; the hooks above still own that. It adds:

- **A line above the prompt** in the terminal and the desktop app's Code tab: `NDZ 212k / 500k  42%`, dim until 80% of the limit, then highlighted. The count is Claude Code's own context figure, refreshed after every turn.
- **A `Handoff now` button** on that line, and `/ndz handoff` for the keyboard. Either one runs the same handoff the hook would, before the limit.
- **`/clear` waiting in the prompt box** once the handoff turn ends, so starting fresh is one Enter. A draft you are typing is never overwritten; the line then shows a `Put /clear in the prompt` button instead.
- **`/ndz`**, which prints the same figures as text. It runs without a model turn, and it is the way to read the meter where nothing is drawn, such as `claude -p`.

Nothing here is needed for the handoff to work. Where the mod does not load, or draws nothing, the plugin behaves exactly as before.

**Cowork does not load the mod** (checked on 0.4.0: `/ndz` is not a command in a Cowork task). The meter there is `/no-dumb-zone:limit show`, which prints `context now: 310,000 tokens, 52% of the limit` under the limit. It works in the terminal too; it costs a model turn where `/ndz` does not.

## Terminal vs Cowork

The plugin detects which surface it is on (`CLAUDE_CODE_ENTRYPOINT=remote_cowork` means Cowork; `NDZ_SURFACE=cowork|terminal` overrides) and behaves differently, because Cowork is a different shape:

| | Terminal, VS Code, Claude Code on the web | Cowork |
| --- | --- | --- |
| Where the project is | On the same filesystem as the hooks | On your computer, in a connected folder; the hooks run in a cloud workspace and cannot see it |
| Handoff writes `NOTES.md` to | the working directory | the connected folder, through the device shell |
| Fresh session | `/clear` | a new task in the same folder |
| Pickup | hook reads `NOTES.md`, sets the title, injects the notes | hook tells Claude where `NOTES.md` lives; Claude reads it from your computer on its first turn |
| Session name | from `NOTES.md` line 1 | Cowork names chats from your first message and ignores hook titles, so the handoff hands you a line to paste as that first message |

So in Cowork the handoff ends with two lines: the confirmation, and a line like `inkbook: booking flow (3). Continue from NOTES.md.` Start a new task in the same folder and paste that line. The chat gets a real name and Claude goes straight to the notes.

That paste line is also how a limit survives in Cowork. The `limit` file lives in the task's container and dies with it, so when the limit came from `/no-dumb-zone:limit`, the handoff line ends with `Then /no-dumb-zone:limit 150000.` and the pickup hook in the next task writes the file from that first message before Claude takes a turn. Test-sized limits (under 10k) are never carried, so a `/no-dumb-zone:limit 1000` test does not re-fire in every task after it. It also works when the task's first turn restarts the session (it does when linking your computer loads the device tools): the hook then reads your first message from the transcript.

## Requirements

- Claude Code v2.1.251 or later for the hooks; v2.1.287 or later for the meter. The 0.4.0 `hooks.json` has only been run on 2.1.293, so if an older Claude Code rejects its `modules` line, stay on 0.3.2 or update.
- `node` on PATH (v18+). Node is the one interpreter that spawns by the same name on Windows, macOS, Linux and the Cowork workspace, which is why the hooks use it.
- `git` on PATH for the commit step and the branch-name fallback

## Install

**From GitHub (terminal, VS Code, Claude Code on the web):**

```
claude plugin marketplace add CjRegan12/no-dumb-zone
claude plugin install no-dumb-zone@cjregan
```

This does not reach Cowork; for that, upload the zip (below).

**Try it for one session without installing** (PowerShell on Windows; macOS and Linux use the same flag):

```powershell
git clone https://github.com/CjRegan12/no-dumb-zone
claude --plugin-dir .\no-dumb-zone
```

**Install everywhere at once (Cowork + terminal):** zip the folder contents and upload under Customize > Plugins > Add > Upload plugin in the desktop app:

```powershell
cd path\to\no-dumb-zone
mkdir dist -Force | Out-Null
tar -a -c -f dist\no-dumb-zone-plugin.zip .claude-plugin/plugin.json .gitignore README.md hooks scripts skills
```

Use `tar -a`, not `Compress-Archive`: the latter writes backslash entry names that Linux unzippers read as flat filenames. Hooks and skills both load in Cowork, and the same install reaches your terminal sessions as `no-dumb-zone@synced` at the next session start. After changing the plugin, re-zip and re-upload; running sessions keep the old version, new ones get the new one.

**Terminal only, from a local clone:** keep using `--plugin-dir`, or set it once per shell with `$env:CLAUDE_CODE_PLUGIN_DIRS = "C:\path\to\no-dumb-zone"`.

## Configure

| Setting | Where | Default | Notes |
| --- | --- | --- | --- |
| `NDZ_LIMIT` | `env` block in `~/.claude/settings.json` (`%USERPROFILE%\.claude\settings.json` on Windows), or a project's `.claude/settings.json` | `500000` terminal, `600000` Cowork | Tokens. Cowork's default is higher because a Cowork task already carries ~130k of system prompt and tool schemas before you type. Both defaults favor long sessions over the published long-context data, which bends around 256k; lower them if you see quality slip. Must be below your auto-compact point or the hook never fires. On a 200k model use ~130000. |
| `autoCompactEnabled` | same settings file | `true` | Set `false` to let this plugin replace compaction instead of racing it. |
| `/no-dumb-zone:limit` | a skill; `/no-dumb-zone:limit 100000`, `100k`, `show`, `clear` | | Writes, prints or removes the `limit` file below and tells you which limit the hook will actually use. `show` also prints the session's current context against that limit. Works in the terminal and inside a Cowork task. Claude also runs it when you say "lower the handoff limit to 100k". |
| `limit` file | `$CLAUDE_PLUGIN_DATA/limit` (`~/.claude/plugins/data/no-dumb-zone-synced/limit` for the uploaded plugin, `.../no-dumb-zone-inline/limit` for `--plugin-dir`) | none | One number. Used when `NDZ_LIMIT` is unset. The only way to change the limit from inside a Cowork task, where env vars can't be set. In the terminal it persists across sessions; a Cowork container is thrown away with the task, so there it lasts one task, and the handoff's paste line carries it into the next (limits under 10k excepted). |

Example settings:

```json
{
  "env": { "NDZ_LIMIT": "130000" },
  "autoCompactEnabled": false
}
```

Run `/context` in a session to see your window size and current usage.

## Files

```
no-dumb-zone/
  .claude-plugin/plugin.json
  hooks/hooks.json                three hooks, exec form, node, plus the mod's entry under "modules"
  hooks/register.ts               the mod: meter above the prompt, Handoff now, /ndz, /clear prefill
  scripts/ndz-check.js            Stop: measure context, force the handoff once, then nag
  scripts/ndz-allow-handoff.js    PermissionRequest: approve the Skill call for this plugin's handoff, nothing else
  scripts/ndz-pickup.js           UserPromptSubmit: brief (and in the terminal, name) the new session from NOTES.md
  scripts/ndz-limit.js            set / show / clear the limit file; what /no-dumb-zone:limit runs
  scripts/ndz-common.js           shared helpers, surface detection, limit resolution
  skills/handoff/SKILL.md         the handoff procedure Claude follows
  skills/limit/SKILL.md           /no-dumb-zone:limit [tokens | show | clear]
  tests/ndz-mod.test.ts           the mod's tests (claude plugin test .); not part of the upload
```

Per-session markers live in `$CLAUDE_PLUGIN_DATA` (or `~/.cache/no-dumb-zone` when run by hand) and are pruned after 7 days.

### Why there's a PermissionRequest hook

Calling a plugin skill through the Skill tool asks for permission. In a terminal you'd click yes; in headless, Cowork, or `dontAsk` sessions nobody can, and the handoff is silently denied. `ndz-allow-handoff.js` approves exactly one call, `Skill(no-dumb-zone:handoff)`, and nothing else. If you'd rather approve it yourself, delete the `PermissionRequest` entry from `hooks/hooks.json` and add this to your settings instead:

```json
{ "permissions": { "allow": ["Skill(no-dumb-zone:handoff)"] } }
```

## Test it fast

Set a tiny limit in a scratch repo so the hook fires on the very first stop:

```powershell
mkdir $env:TEMP\ndz-test; cd $env:TEMP\ndz-test; git init
$env:NDZ_LIMIT = "1000"
claude --plugin-dir C:\path\to\no-dumb-zone
```

Or, with the plugin installed, skip the env var and type `/no-dumb-zone:limit 1000` as your first message.

Ask for one small thing. Claude should finish it, then run the handoff and tell you to `/clear`. Clear, type anything, and the session title should match the first line of `NOTES.md`. Remove `$env:NDZ_LIMIT` afterwards (`Remove-Item Env:NDZ_LIMIT`) or close the terminal.

**Cowork:** no env vars, so use the limit file. In a task with the project folder connected, type `/no-dumb-zone:limit 1000`, then ask for one small thing. Claude should finish it, run the handoff into the connected folder, and end with the two-line message. Start a new task, paste the second line, and Claude should read `NOTES.md` from the folder on its first turn.

Run a hook by hand with fake input:

```powershell
'{"session_id":"t1","transcript_path":"C:\\path\\to\\some.jsonl","stop_hook_active":false}' | node scripts\ndz-check.js; $LASTEXITCODE
```

## Troubleshooting

- **Nothing happens at the limit.** Auto-compact probably fired first. Lower the limit (`/no-dumb-zone:limit 130000`) or set `autoCompactEnabled: false`.
- **`/no-dumb-zone:limit` wrote the file but the hook still uses the old number.** `NDZ_LIMIT` in the environment wins over the file; `/no-dumb-zone:limit show` says so when that is the case. In Cowork the file is per task; it reaches the next task only through the handoff's paste line (`... Then /no-dumb-zone:limit 150000.`), so a task started with a plain first message starts at the default again. Type `/no-dumb-zone:limit 150k` there, or start the task with that line.
- **`claude plugin list` says `no-dumb-zone@synced` was not loaded.** You also installed it from the marketplace or `--plugin-dir`. Same name, so the terminal loads only the local copy and skips the synced one; Cowork is unaffected and keeps running the synced copy. Pick one for the terminal (`claude plugin uninstall no-dumb-zone@cjregan` to go back to synced).
- **Cowork task started without the folder connected.** The pickup hook still fires; it tells Claude to request access to the project folder rather than search its workspace. Connecting the folder when you start the task skips that step.
- **`<hook> hook error` in the transcript.** Run `claude --debug-file ndz.log` and read the log. Usually `node` isn't on PATH for the process that launched Claude, or the transcript layout changed; `ndz-check.js` looks for `message.usage` on `type: assistant` lines.
- **Session didn't get named (terminal).** The hook skips sessions that already have a title (`--name`, `/rename`). It also only acts on the first prompt; check `/hooks` to confirm `UserPromptSubmit` is listed.
- **Cowork chat got a random name / the new chat went hunting for context.** Cowork names chats from your first message and the hooks cannot read your connected folder. Paste the title line the handoff gave you as the first message of the new task; that names the chat and points Claude at `NOTES.md`. If you lost the line, `<project>: <task>. Continue from NOTES.md.` works too.
- **Handoff ran while Claude was asking me a question.** Expected. A question ends the turn, so it counts as a stop. The question lands under "Open questions" in `NOTES.md`.

## Not in scope (yet)

- Pressing `/clear` or opening the new task for you. Hooks can't run slash commands or drive the Cowork UI. In the terminal the mod gets as close as it can: `/clear` is typed into the prompt box and you press Enter.
- Naming a Cowork chat from a hook. Cowork ignores `sessionTitle`; the pasted first line is the workaround.
- A percentage limit instead of a token count.
