# no-dumb-zone: v0.2 Cowork mode (3)

## Done this session
- Step 1 confirmed: this task ran the 0.2.0 synced plugin (checked the container copy under `~/.claude/plugins/synced/`).
- Step 2 passed: the Cowork pickup context fired on the first message and Claude read `NOTES.md` from the device before doing anything else. Wrinkle: the task started with no folder connected, so Claude had to request access to the repo folder first (path came from project memory).
- Fixed the wrinkle: `ndz-pickup.js` Cowork pointer now tells Claude to request the project folder (or ask the user) rather than search the workspace.
- Added the `limit` file: `NDZ_LIMIT` env > `$CLAUDE_PLUGIN_DATA/limit` > 250000. Cowork tasks cannot set env vars, so this is the only in-task knob. `pruneOldMarkers` now touches only `handoff-*`/`pickup-*` so the file survives.
- Tests: 19 tightened, 22 to 24 added, 25 pass in the Cowork VM. README (Configure table row, Cowork test recipe, troubleshooting entry) and CLAUDE.md updated. Version 0.2.1. Committed as `f66d3ad`, lock files cleaned (delete permission granted for the folder).
- Rebuilt `dist/no-dumb-zone-plugin.zip` at 0.2.1 (10 entries, forward slashes) with python zipfile from the VM. Not yet uploaded.
- Step 3 ran live in this task: copied the new scripts over the container's synced copy, wrote `limit` = 1000, ended the turn. The Stop hook fired at 184k tokens with `Surface: Cowork`, the handoff skill ran without a permission prompt, and this file is its output. If you are reading this from a new task, the pickup half worked too.

## Decisions and why
- Limit override is a file in `$CLAUDE_PLUGIN_DATA`, not a project file: hooks in Cowork cannot read the project folder, and the data dir is the one place both hooks and Claude's workspace shell can reach.
- Shipped the pickup fix and the limit file as 0.2.1 instead of folding them into 0.2.0: the user re-uploads anyway, and the commit history shows what the live test changed.
- Committed the 0.2.1 code before forcing the handoff so the handoff commit holds only NOTES.md and CLAUDE.md.

## Next steps
1. Upload `dist/no-dumb-zone-plugin.zip` (0.2.1) under Customize > Plugins, replacing no-dumb-zone 0.2.0. Until then new tasks run 0.2.0, which lacks the `limit` file and the unconnected-folder sentence.
2. Confirm this task's own pickup: if this file was read from `$HOME/mnt/no-dumb-zone/NOTES.md` on the first turn without searching, step 3 is fully closed. Note the result in the next NOTES.md and move on.
3. Carry over from v0.1: use it on InkBook for a day, then decide nag frequency (every stop vs every third), auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.
4. Move the GateGuard gotcha into `C:\Users\regan\.claude\CLAUDE.md`.
5. Rename `master` to `main`, push to GitHub (`gh repo create no-dumb-zone --public --source . --push`), optional `marketplace.json`.

## Open questions for the user
- Should the Cowork pickup context fire in every Cowork task (current), or stay quiet unless the first message mentions NOTES.md?
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still open from v0.1.
- Should the `limit` file get a skill (`/no-dumb-zone:limit 100000`) so the user does not have to spell out the shell command in Cowork?

## Files touched
- scripts/ndz-check.js: `resolveLimit()` with the data-dir `limit` file
- scripts/ndz-common.js: prune only marker files
- scripts/ndz-pickup.js: unconnected-folder sentence in the Cowork pointer
- scripts/test.sh: case 19 tightened, 22 to 24 added
- README.md: limit file row, Cowork test recipe, troubleshooting entry
- CLAUDE.md: limit order, Cowork live-test recipe, VM packaging, Stop hook feedback shape
- .claude-plugin/plugin.json: 0.2.1
- dist/no-dumb-zone-plugin.zip: rebuilt (gitignored)
- NOTES.md: this file
