# no-dumb-zone: v0.2 Cowork mode (4)

## Done this session
- Step 2 closed: this task ran the synced 0.2.0 copy (0.2.1 was never uploaded), the pickup context fired on the first message, Claude requested the repo folder (path from project memory) and read `NOTES.md` from `$HOME/mnt/no-dumb-zone/NOTES.md` before anything else. The pickup half works in Cowork; the 0.2.1 "request the folder" sentence has still not been seen live because 0.2.1 never shipped.
- Decided with the user: build the limit skill (yes), keep the Cowork pickup context firing in every task (no keyword gating).
- Built `/no-dumb-zone:limit [tokens | show | clear]`: `skills/limit/SKILL.md` runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/ndz-limit.js --data-dir "${CLAUDE_PLUGIN_DATA}" $ARGUMENTS`. Accepts `100000`, `100k`, `0.5m`; `show` prints the effective limit and its source; `clear` deletes the file. Warns when `NDZ_LIMIT` wins, when the limit is test-sized (<10k) or above the default.
- Limit helpers (`resolveLimit(dir)` -> `{limit, source}`, `limitFilePath`, `limitFromFile`, `positiveInt`, `DEFAULT_LIMIT`) moved into `ndz-common.js`; `ndz-check.js` uses them.
- Tests 25 to 30 added, 32 pass in the Cowork VM. `claude plugin validate` passes (run in the Cowork container on a staged copy).
- Live-tested the skill headlessly from the container: `claude -p "/no-dumb-zone:limit 42k" --plugin-dir <staged copy>` wrote `~/.claude/plugins/data/no-dumb-zone-inline/limit`, `show` and `clear` behaved. So `${CLAUDE_PLUGIN_DATA}` substitution in skill bodies is confirmed, and `--plugin-dir` installs resolve to `no-dumb-zone-inline`.
- README (Configure rows, Files, Cowork test recipe, troubleshooting), CLAUDE.md (test count, validate/headless recipe, limit conventions, data-dir ids) updated. Version 0.2.2, committed as `bff9d41`. `dist/no-dumb-zone-plugin.zip` rebuilt at 0.2.2 (12 entries, forward slashes). Not yet uploaded.
- Later in the same session: user renamed `master` to `main` and pushed; repo is https://github.com/CjRegan12/no-dumb-zone. Added `.claude-plugin/marketplace.json` (marketplace `cjregan`, source `.`), `homepage`/`repository` in plugin.json, GitHub install route in README, personal paths scrubbed from README. Validated and test-installed from the marketplace inside the Cowork container (`claude plugin install no-dumb-zone@cjregan`), then uninstalled. Found that a same-named local install makes the terminal skip `@synced`; documented in README and CLAUDE.md. Commit `4f61c6d`. Zip rebuilt again (plugin.json only from `.claude-plugin/`, 12 entries, 0.2.2).
- Checked and ruled out from inside a task: the container's `gh` has no valid token and the Cowork VM has no `gh`, so GitHub push is a PowerShell job. `C:\Users\regan\.claude\` is a protected folder the device tools cannot open, so the global CLAUDE.md edit is also the user's.

## Decisions and why
- The skill passes the data dir as an argument instead of the script deriving it: Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` in skill Markdown but never exports it to the Bash tool, and the dir name depends on how the plugin was installed (`-synced` vs `-inline`). Deriving it would be guessing.
- `allowed-tools: Bash(node *)` on the limit skill so it runs without a prompt in headless and Cowork sessions. Narrower patterns with a mid-string wildcard are not worth relying on.
- Did not force a handoff at the end of this session (the 0.2.1 session did that as its live test). Wrote this file by hand instead so the final message could carry the manual steps.

## Next steps
1. User, in the desktop app: upload `dist\no-dumb-zone-plugin.zip` (0.2.2) under Customize > Plugins, replacing no-dumb-zone 0.2.0. Until then every new task runs 0.2.0, which has neither the limit file nor the limit skill.
2. First turn of the next Cowork task after the upload: run `/no-dumb-zone:limit show`. Expected path in the output: `~/.claude/plugins/data/no-dumb-zone-synced/limit`. That confirms the skill under the synced install; note it here and the v0.2 workstream is done.
3. User, in PowerShell: `git push` (commit `4f61c6d` is local only). Optional: add a LICENSE file (none yet; the repo is public) and set `license` in plugin.json to match.
4. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. The line is not in this repo; look in those repos.
5. Carry over from v0.1: use the plugin on InkBook for a day, then decide nag frequency (every stop vs every third), auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still open, deferred until after a day of real use.
- Should `/no-dumb-zone:limit` with no argument in a Cowork task also print the one-liner to re-apply the limit in the next task, since the file dies with the container?

## Files touched
- scripts/ndz-limit.js: new; set / show / clear the limit file, `--data-dir` from the skill
- skills/limit/SKILL.md: new; `/no-dumb-zone:limit [tokens | show | clear]`
- scripts/ndz-common.js: limit helpers (`resolveLimit`, `limitFilePath`, `limitFromFile`, `positiveInt`, `DEFAULT_LIMIT`, `LIMIT_FILE`) and exports
- scripts/ndz-check.js: uses the shared `resolveLimit`; dropped its own copy and the unused `path` import
- scripts/test.sh: cases 25 to 30 for ndz-limit.js, one of them script -> hook
- README.md: `/no-dumb-zone:limit` row, data-dir ids, Files list, Cowork test recipe, two troubleshooting bullets
- CLAUDE.md: 32 cases, validate + headless recipe from the container, limit convention, data-dir gotcha
- .claude-plugin/plugin.json: 0.2.2
- dist/no-dumb-zone-plugin.zip: rebuilt (gitignored)
- NOTES.md: this file
