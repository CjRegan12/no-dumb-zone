# no-dumb-zone

A Claude Code plugin that hands off and clears before context gets dumb.

Long sessions compacted over and over lose the constraints you stated early, and Claude gets worse as the context window fills. The fix everyone knows and nobody does by hand: keep state in files, `/clear` between tasks. This plugin does it for you.

## What it does

1. Every time Claude finishes a turn, a `Stop` hook reads the session transcript and checks the live context size.
2. Past the limit (default 250k tokens), the hook blocks the stop once and tells Claude to run `/no-dumb-zone:handoff`.
3. The handoff skill updates `CLAUDE.md` with durable learnings, writes `NOTES.md` with task state and next steps, commits, and tells you how to start fresh (`/clear` in the terminal, a new task in Cowork).
4. On your first prompt in the fresh session, a `UserPromptSubmit` hook briefs Claude from `NOTES.md`. In the terminal it also names the session from the file's first line. You continue where you left off at ~20k tokens instead of 250k.

It never interrupts a task. `Stop` only fires when Claude has stopped on its own, so a task in progress always finishes first.

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

## Requirements

- Claude Code v2.1.251 or later
- `node` on PATH (v18+). Node is the one interpreter that spawns by the same name on Windows, macOS, Linux and the Cowork workspace, which is why the hooks use it.
- `git` on PATH for the commit step and the branch-name fallback

## Install

**Try it for one session** (PowerShell on Windows):

```powershell
claude --plugin-dir C:\Users\regan\source\repos\no-dumb-zone
```

macOS or Linux: same flag, your path.

**Install everywhere at once (Cowork + terminal):** zip the folder contents and upload under Customize > Plugins > Add > Upload plugin in the desktop app:

```powershell
cd C:\Users\regan\source\repos\no-dumb-zone
mkdir dist -Force | Out-Null
tar -a -c -f dist\no-dumb-zone-plugin.zip .claude-plugin .gitignore README.md hooks scripts skills
```

Use `tar -a`, not `Compress-Archive`: the latter writes backslash entry names that Linux unzippers read as flat filenames. Hooks and skills both load in Cowork, and the same install reaches your terminal sessions as `no-dumb-zone@synced` at the next session start. After changing the plugin, re-zip and re-upload; running sessions keep the old version, new ones get the new one.

**Terminal only, without the account:** keep using `--plugin-dir`, or set it once per shell with `$env:CLAUDE_CODE_PLUGIN_DIRS = "C:\Users\regan\source\repos\no-dumb-zone"`.

## Configure

| Setting | Where | Default | Notes |
| --- | --- | --- | --- |
| `NDZ_LIMIT` | `env` block in `~/.claude/settings.json` (`C:\Users\regan\.claude\settings.json`), or a project's `.claude/settings.json` | `250000` | Tokens. Must be below your auto-compact point or the hook never fires. On a 200k model use ~130000. |
| `autoCompactEnabled` | same settings file | `true` | Set `false` to let this plugin replace compaction instead of racing it. |
| `limit` file | `$CLAUDE_PLUGIN_DATA/limit` (`~/.claude/plugins/data/no-dumb-zone-synced/limit` for the synced plugin) | none | One number. Used when `NDZ_LIMIT` is unset. The only way to change the limit from inside a Cowork task, where env vars can't be set: ask Claude to write it in its workspace shell. The Cowork container is thrown away with the task, so it lasts one task. |

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
  hooks/hooks.json                three hooks, exec form, node
  scripts/ndz-check.js            Stop: measure context, force the handoff once, then nag
  scripts/ndz-allow-handoff.js    PermissionRequest: approve the Skill call for this plugin's handoff, nothing else
  scripts/ndz-pickup.js           UserPromptSubmit: brief (and in the terminal, name) the new session from NOTES.md
  scripts/ndz-common.js           shared helpers, surface detection
  skills/handoff/SKILL.md         the handoff procedure Claude follows
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
claude --plugin-dir C:\Users\regan\source\repos\no-dumb-zone
```

Ask for one small thing. Claude should finish it, then run the handoff and tell you to `/clear`. Clear, type anything, and the session title should match the first line of `NOTES.md`. Remove `$env:NDZ_LIMIT` afterwards (`Remove-Item Env:NDZ_LIMIT`) or close the terminal.

**Cowork:** no env vars, so use the limit file. In a task with the project folder connected, say: "run `echo 1000 > ~/.claude/plugins/data/no-dumb-zone-synced/limit` in your workspace shell, then do one small thing". Claude should finish it, run the handoff into the connected folder, and end with the two-line message. Start a new task, paste the second line, and Claude should read `NOTES.md` from the folder on its first turn.

Run a hook by hand with fake input:

```powershell
'{"session_id":"t1","transcript_path":"C:\\path\\to\\some.jsonl","stop_hook_active":false}' | node scripts\ndz-check.js; $LASTEXITCODE
```

## Troubleshooting

- **Nothing happens at the limit.** Auto-compact probably fired first. Lower `NDZ_LIMIT` (or the `limit` file) or set `autoCompactEnabled: false`.
- **Cowork task started without the folder connected.** The pickup hook still fires; it tells Claude to request access to the project folder rather than search its workspace. Connecting the folder when you start the task skips that step.
- **`<hook> hook error` in the transcript.** Run `claude --debug-file ndz.log` and read the log. Usually `node` isn't on PATH for the process that launched Claude, or the transcript layout changed; `ndz-check.js` looks for `message.usage` on `type: assistant` lines.
- **Session didn't get named (terminal).** The hook skips sessions that already have a title (`--name`, `/rename`). It also only acts on the first prompt; check `/hooks` to confirm `UserPromptSubmit` is listed.
- **Cowork chat got a random name / the new chat went hunting for context.** Cowork names chats from your first message and the hooks cannot read your connected folder. Paste the title line the handoff gave you as the first message of the new task; that names the chat and points Claude at `NOTES.md`. If you lost the line, `<project>: <task>. Continue from NOTES.md.` works too.
- **Handoff ran while Claude was asking me a question.** Expected. A question ends the turn, so it counts as a stop. The question lands under "Open questions" in `NOTES.md`.

## Not in scope (yet)

- Pressing `/clear` or opening the new task for you. Hooks can't run slash commands or drive the Cowork UI.
- Naming a Cowork chat from a hook. Cowork ignores `sessionTitle`; the pasted first line is the workaround.
- A percentage limit instead of a token count.
