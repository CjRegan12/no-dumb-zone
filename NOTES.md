# no-dumb-zone: v0.2 Cowork mode (5)

## Done this session
- Step 2 closed: pickup fired on the first message, Claude requested the repo folder and read `NOTES.md` from `$HOME/mnt/no-dumb-zone/NOTES.md` before anything else.
- Decided with the user: limit skill yes; Cowork pickup context keeps firing in every task.
- Built `/no-dumb-zone:limit [tokens | show | clear]` (`skills/limit/SKILL.md` + `scripts/ndz-limit.js`, `--data-dir "${CLAUDE_PLUGIN_DATA}"` passed from the skill body). Limit helpers moved to `ndz-common.js`. Tests 25 to 30 added, 32 pass. Headless live test from the container with `--plugin-dir` wrote `~/.claude/plugins/data/no-dumb-zone-inline/limit`. Version 0.2.2, commit `bff9d41`.
- User renamed `master` to `main` and pushed: https://github.com/CjRegan12/no-dumb-zone.
- Public-repo pass: `.claude-plugin/marketplace.json` (marketplace `cjregan`, source `.`), `homepage`/`repository` in plugin.json, GitHub install route in README, personal paths scrubbed from README, zip now takes only `.claude-plugin/plugin.json`. Validated and test-installed from the marketplace in the container, then uninstalled. Commits `4f61c6d`, `6d320ad`. Not pushed yet.
- 0.2.2 appears uploaded: mid-session the synced plugin re-synced into this task as `no-dumb-zone~g2` (version 0.2.2), `/no-dumb-zone:limit` showed up in the skill list, and this handoff was forced by the 0.2.2 Stop hook at 275k tokens, Surface: Cowork, with no permission prompt.

## Decisions and why
- Skill passes the data dir as an argument: Claude Code substitutes `${CLAUDE_PLUGIN_DATA}` in skill Markdown but never exports it to the Bash tool, and the dir name depends on the install (`-synced`, `-inline`, `-cjregan`).
- `allowed-tools: Bash(node *)` on the limit skill so it runs unprompted in headless and Cowork sessions.
- marketplace.json stays out of the upload zip: the zip is the Cowork install, the marketplace is the terminal install.

## Next steps
1. User, in PowerShell from the repo: `git push` (two local commits, `4f61c6d` and `6d320ad`, plus this handoff).
2. First turn of the next Cowork task: `/no-dumb-zone:limit show`. Expected output names `~/.claude/plugins/data/no-dumb-zone-synced/limit` (or a `~g2`-style id if the data dir follows the generation suffix; record whichever it is). If the skill is missing, 0.2.2 was not uploaded after all: upload `dist\no-dumb-zone-plugin.zip` under Customize > Plugins.
3. User: add a LICENSE file (repo is public, none yet) and set `license` in plugin.json to match.
4. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
5. Carry over from v0.1: use the plugin on InkBook for a day, then decide nag frequency (every stop vs every third), auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: deferred until after a day of real use.
- Should `/no-dumb-zone:limit` with no argument in a Cowork task also print the one-liner to re-apply the limit in the next task, since the file dies with the container?

## Files touched
- scripts/ndz-limit.js: new; set / show / clear the limit file
- skills/limit/SKILL.md: new; `/no-dumb-zone:limit`
- scripts/ndz-common.js: limit helpers and exports
- scripts/ndz-check.js: uses shared `resolveLimit`
- scripts/test.sh: cases 25 to 30
- .claude-plugin/marketplace.json: new; marketplace `cjregan`
- .claude-plugin/plugin.json: 0.2.2, homepage, repository
- README.md: limit skill rows, GitHub install, generic paths, two troubleshooting bullets
- CLAUDE.md: test count, validate/headless recipe, limit convention, data-dir ids, same-name precedence, re-sync `~g2` gotcha
- dist/no-dumb-zone-plugin.zip: rebuilt 0.2.2 (gitignored)
- NOTES.md: this file
