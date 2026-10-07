# no-dumb-zone

A Claude Code plugin that hands off and clears before context gets dumb.

Long sessions compacted over and over lose the constraints you stated early, and Claude gets worse as the context window fills. The fix everyone knows and nobody does by hand: keep state in files, `/clear` between tasks. This plugin does it for you.

## What it does

1. Every time Claude finishes a turn, a `Stop` hook reads the session transcript and checks the live context size.
2. Past the limit (default 250k tokens), the hook blocks the stop once and tells Claude to run `/no-dumb-zone:handoff`.
3. The handoff skill updates `CLAUDE.md` with durable learnings, writes `NOTES.md` with task state and next steps, commits, and tells you to `/clear`.
4. On your first prompt in the fresh session, a `UserPromptSubmit` hook names the session from the first line of `NOTES.md` and feeds the whole file to Claude as context. You continue where you left off at ~20k tokens instead of 250k.

It never interrupts a task. `Stop` only fires when Claude has stopped on its own, so a task in progress always finishes first.

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
Get-ChildItem C:\Users\regan\source\repos\no-dumb-zone -Exclude .git |
  Compress-Archive -DestinationPath C:\Users\regan\Downloads\no-dumb-zone.zip -Force
```

Hooks and skills both load in Cowork, and the same install reaches your terminal sessions as `no-dumb-zone@synced` at the next session start. After changing the plugin, re-zip and re-upload.

**Terminal only, without the account:** keep using `--plugin-dir`, or set it once per shell with `$env:CLAUDE_CODE_PLUGIN_DIRS = "C:\Users\regan\source\repos\no-dumb-zone"`.

## Configure

| Setting | Where | Default | Notes |
| --- | --- | --- | --- |
| `NDZ_LIMIT` | `env` block in `~/.claude/settings.json` (`C:\Users\regan\.claude\settings.json`), or a project's `.claude/settings.json` | `250000` | Tokens. Must be below your auto-compact point or the hook never fires. On a 200k model use ~130000. |
| `autoCompactEnabled` | same settings file | `true` | Set `false` to let this plugin replace compaction instead of racing it. |

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
  scripts/ndz-pickup.js           UserPromptSubmit: name + brief the new session from NOTES.md
  scripts/ndz-common.js           shared helpers
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

Run a hook by hand with fake input:

```powershell
'{"session_id":"t1","transcript_path":"C:\\path\\to\\some.jsonl","stop_hook_active":false}' | node scripts\ndz-check.js; $LASTEXITCODE
```

## Troubleshooting

- **Nothing happens at the limit.** Auto-compact probably fired first. Lower `NDZ_LIMIT` or set `autoCompactEnabled: false`.
- **`<hook> hook error` in the transcript.** Run `claude --debug-file ndz.log` and read the log. Usually `node` isn't on PATH for the process that launched Claude, or the transcript layout changed; `ndz-check.js` looks for `message.usage` on `type: assistant` lines.
- **Session didn't get named.** The hook skips sessions that already have a title (`--name`, `/rename`). It also only acts on the first prompt; check `/hooks` to confirm `UserPromptSubmit` is listed.
- **Handoff ran while Claude was asking me a question.** Expected. A question ends the turn, so it counts as a stop. The question lands under "Open questions" in `NOTES.md`.

## Not in scope (yet)

- Pressing `/clear` for you. Hooks can't run slash commands.
- A percentage limit instead of a token count.
