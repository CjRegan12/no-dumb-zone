# no-dumb-zone

Claude Code plugin: Stop hook forces a handoff past a token limit, PermissionRequest hook approves the plugin's own skill, UserPromptSubmit hook names and briefs the next session from NOTES.md.

## Commands

- Unit tests: `bash scripts/test.sh` (32 cases; needs bash, so Git Bash on Windows or the Cowork VM). The suite pins `NDZ_SURFACE=terminal` and overrides per case, so it passes identically inside a Cowork session.
- Validate: `claude plugin validate .` picks `marketplace.json` once that exists; pass `.claude-plugin/plugin.json` to validate the plugin manifest. The Cowork container has `claude` too: stage the plugin files into `/mnt/user-data/uploads/no-dumb-zone/` and validate there. From that copy, `claude -p "/no-dumb-zone:limit show" --plugin-dir /mnt/user-data/uploads/no-dumb-zone --allowedTools "Bash(node *)"` is a real headless test of a skill (unset `CLAUDE_CODE_ENTRYPOINT` first or it reports the Cowork surface).
- Live test: in a scratch git repo, `$env:NDZ_LIMIT="1000"; claude --plugin-dir C:\Users\regan\source\repos\no-dumb-zone`, ask for one small file, watch the handoff run.
- Live test in Cowork without a re-upload: inside the task, `/no-dumb-zone:limit 1000` (or, on a synced copy older than 0.2.2, `echo 1000 > ~/.claude/plugins/data/no-dumb-zone-synced/limit` in the workspace shell, not the device). To also test unreleased script changes, copy them over the synced copy under `~/.claude/plugins/synced/*/no-dumb-zone/scripts/`; hook scripts are read at exec time, so the next Stop runs the new code. Both are per-container and vanish with the task.
- Package for Cowork: from the repo root, `mkdir dist -Force; tar -a -c -f dist\no-dumb-zone-plugin.zip .claude-plugin/plugin.json .gitignore README.md hooks scripts skills` (only `plugin.json` from `.claude-plugin/`; `marketplace.json` is for `claude plugin marketplace add CjRegan12/no-dumb-zone` and stays out of the upload) (`dist/` is gitignored). Never `Compress-Archive`: it writes backslash entry names that Linux unzippers read as flat filenames. Upload under Customize > Plugins > Add > Upload plugin; it syncs to terminal sessions as `no-dumb-zone@synced`. From the Cowork VM there is no `tar -a` zip support; `python3` + `zipfile` writing `f.as_posix()` entry names gives the same 10-entry archive.

## Conventions and why

- Hook scripts are Node, exec form (`"command": "node", "args": [...]`). `node` is the only interpreter name that resolves identically on Windows, macOS, Linux and the Cowork VM. Do not switch back to `python3` or bash+jq; `python3` does not resolve on Windows.
- Pickup runs on `UserPromptSubmit`, not `SessionStart`: SessionStart ignores `sessionTitle` when the source is `clear`.
- The PermissionRequest hook uses a plain `Skill` matcher and checks the skill name inside the script. The `if: "Skill(no-dumb-zone:handoff)"` filter does not match Skill calls (confirmed in debug log).
- No SessionEnd hook on purpose; `ndz-check.js` prunes `handoff-*`/`pickup-*` markers older than 7 days instead. Markers live in `$CLAUDE_PLUGIN_DATA`, next to the optional `limit` file (never pruned).
- Limit resolution order: `NDZ_LIMIT` env, then `$CLAUDE_PLUGIN_DATA/limit`, then 250000. The helpers (`resolveLimit(dir)` -> `{limit, source}`, `limitFilePath`, `positiveInt`) live in `ndz-common.js` and are shared by `ndz-check.js` and `ndz-limit.js`. The file exists because Cowork tasks cannot set env vars; it is the only in-task knob.
- `/no-dumb-zone:limit` passes `${CLAUDE_PLUGIN_DATA}` to `ndz-limit.js --data-dir`: Claude Code substitutes that variable in skill Markdown but does not export it to the Bash tool, so a script run by a skill cannot find the hooks' data dir on its own. An empty or unsubstituted `--data-dir` falls back to `dataDir()`, the same place the hooks fall back to.
- Plugin default `settings.json` only honors `agent` and `subagentStatusLine`, so permission rules can't ship with the plugin.
- Surface detection lives in `ndz-common.js` `isCowork()`: `CLAUDE_CODE_ENTRYPOINT=remote_cowork` (verified from inside a live Cowork task), overridable with `NDZ_SURFACE`. Every surface-specific string in the scripts and the skill branches on it; keep it that way rather than scattering env checks.
- Cowork is a different shape, not just a different UI: hooks run in a cloud container whose cwd is `/home/claude`, and the user's project folder is only reachable through the device tools (`$HOME/mnt/<folder>` in `device_bash`). So in Cowork the hooks can never read or write `NOTES.md`; the skill writes it on the device and the pickup hook tells Claude to read it from there. Cowork also names chats from the first message and ignores `sessionTitle`.

## Gotchas

- Transcript layout: `type: "assistant"` lines carry `message.usage` with `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`; their sum is the live context. Verified against real transcripts.
- A `claude -p` run started from inside a Claude session inherits the parent `session_id`, so clear `~/.claude/plugins/data/no-dumb-zone-*/` markers between end-to-end runs.
- Plugin names must be unique per machine: a `no-dumb-zone@cjregan` (marketplace) or `@inline` (`--plugin-dir`) install makes the terminal skip `no-dumb-zone@synced` with a `not loaded ... takes precedence` warning in `claude plugin list`. Cowork only ever has the synced copy. Verified by installing from the marketplace inside a Cowork container (`claude plugin marketplace add <dir>`, `claude plugin install no-dumb-zone@cjregan`), then uninstalling.
- `$CLAUDE_PLUGIN_DATA` is `~/.claude/plugins/data/<plugin id with non [A-Za-z0-9_-] as ->`: `no-dumb-zone-synced` for the uploaded plugin, `no-dumb-zone-inline` for `--plugin-dir`. Two installs side by side keep separate `limit` files and markers.
- The Cowork workspace on Windows is an Ubuntu 22.04 VM (node 22, python3, jq, git). Hooks run there as on Linux.
- Committing from the Cowork VM into a mounted Windows folder leaves `.git/*.lock` and `objects/*/tmp_obj_*` behind unless deletion is enabled for the folder (ask with `device_request_delete_permission`, then `find .git \( -name '*.lock' -o -name 'tmp_obj_*' \) -type f -delete`); remove them or the next git command fails.
- Debug a hook: `claude --debug-file ndz.log`, then grep the log for the hook name.
- Uploading a new zip re-syncs into running Cowork tasks as a sibling dir with a generation suffix (`no-dumb-zone~g2`); hooks and skills from the new version start firing in the live task, so a running task is not a clean test of the old version after an upload. `${CLAUDE_PLUGIN_ROOT}` follows the suffix; never hardcode the synced path.
- In Cowork, a Stop hook exit 2 arrives as a `Stop hook feedback:` user turn carrying the stderr text, in the same task; the Skill call for the handoff then runs without a permission prompt (PermissionRequest hook). Verified live.
