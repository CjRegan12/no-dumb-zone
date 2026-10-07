# no-dumb-zone

Claude Code plugin: Stop hook forces a handoff past a token limit, PermissionRequest hook approves the plugin's own skill, UserPromptSubmit hook names and briefs the next session from NOTES.md.

## Commands

- Unit tests: `bash scripts/test.sh` (17 cases; needs bash, so Git Bash on Windows or the Cowork VM).
- Validate: `claude plugin validate .`
- Live test: in a scratch git repo, `$env:NDZ_LIMIT="1000"; claude --plugin-dir C:\Users\regan\source\repos\no-dumb-zone`, ask for one small file, watch the handoff run.
- Package for Cowork: from the repo root, `tar -a -c -f C:\Users\regan\Downloads\no-dumb-zone-plugin.zip .claude-plugin .gitignore README.md hooks scripts skills`. Never `Compress-Archive`: it writes backslash entry names that Linux unzippers read as flat filenames. Upload under Customize > Plugins > Add > Upload plugin; it syncs to terminal sessions as `no-dumb-zone@synced`.

## Conventions and why

- Hook scripts are Node, exec form (`"command": "node", "args": [...]`). `node` is the only interpreter name that resolves identically on Windows, macOS, Linux and the Cowork VM. Do not switch back to `python3` or bash+jq; `python3` does not resolve on Windows.
- Pickup runs on `UserPromptSubmit`, not `SessionStart`: SessionStart ignores `sessionTitle` when the source is `clear`.
- The PermissionRequest hook uses a plain `Skill` matcher and checks the skill name inside the script. The `if: "Skill(no-dumb-zone:handoff)"` filter does not match Skill calls (confirmed in debug log).
- No SessionEnd hook on purpose; `ndz-check.js` prunes markers older than 7 days instead. Markers live in `$CLAUDE_PLUGIN_DATA`.
- Plugin default `settings.json` only honors `agent` and `subagentStatusLine`, so permission rules can't ship with the plugin.

## Gotchas

- Transcript layout: `type: "assistant"` lines carry `message.usage` with `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`; their sum is the live context. Verified against real transcripts.
- A `claude -p` run started from inside a Claude session inherits the parent `session_id`, so clear `~/.claude/plugins/data/no-dumb-zone-*/` markers between end-to-end runs.
- The Cowork workspace on Windows is an Ubuntu 22.04 VM (node 22, python3, jq, git). Hooks run there as on Linux.
- Committing from the Cowork VM into a mounted Windows folder leaves `.git/*.lock` and `objects/*/tmp_obj_*` behind unless deletion is enabled for the folder; remove them afterwards or the next git command fails.
- Debug a hook: `claude --debug-file ndz.log`, then grep the log for the hook name.
