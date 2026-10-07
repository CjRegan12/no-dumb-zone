# no-dumb-zone: v0.2 Cowork mode (6)

## Done this session
- Step 2 closed for 0.2.2: in a fresh Cowork task, `/no-dumb-zone:limit show` printed `/root/.claude/plugins/data/no-dumb-zone-synced/limit (absent)`, 250,000 default. The data dir has no generation suffix. The pickup's "request the folder" sentence fired and worked (folder requested from project memory, NOTES.md read first).
- Steps 1 and 3 were already done by the user before this task: `main` pushed, `LICENSE` (MIT) added on GitHub, `license: MIT` in plugin.json (`5b3b486`, `cf1efb7`).
- Closed the open question with 0.2.3, "Cowork limit carry-over": a limit set with `/no-dumb-zone:limit` inside a Cowork task now survives into the next task. `ndz-check.js` (Cowork, limit from the file, >= 10k) tells the handoff to end its paste line with `Then /no-dumb-zone:limit <n>.`; `skills/handoff/SKILL.md` step 4 appends it; `ndz-pickup.js` parses the first prompt of the next task and writes the limit file before Claude's first turn, then says so in `additionalContext`. `parseTokens`, `limitFromPrompt`, `writeLimitFile`, `TEST_SIZED_BELOW` live in `ndz-common.js`. `ndz-limit.js` set/show in Cowork say whether the limit will carry.
- Tests 31 to 37b added, 40 pass in the VM. `claude plugin validate` passes for both manifests. Headless `claude -p "inkbook: booking flow (4). Continue from NOTES.md. Then /no-dumb-zone:limit 150k." --plugin-dir <staged copy>` from the container wrote `no-dumb-zone-inline/limit` = 150000 on the first prompt (real hook, not the harness).
- Commit `239e676` (code, docs, 0.2.3). `dist/no-dumb-zone-plugin.zip` rebuilt at 0.2.3 with python zipfile (12 entries, includes scripts/test.sh like the tar recipe). Not pushed: `git push` from the VM gets a 403 from the proxy.
- Deletion was approved for the repo folder this task; git locks were cleared after each commit.

## Decisions and why
- Carry via the paste line, not via NOTES.md or a `show` reminder: the paste line is the only thing that already crosses from one Cowork task to the next, and the pickup hook can act on it deterministically without Claude's cooperation.
- Test-sized limits (< 10k) are never carried, or a `/no-dumb-zone:limit 1000` test would re-fire the handoff in every task after it.
- The pickup hook applies any `/no-dumb-zone:limit <n>` in the first prompt, test-sized included: a user who types it wants it. Only the emit side filters.
- `LICENSE` shows modified from the VM (CRLF vs LF, no autocrlf there). Phantom; not committed. Stage by name from the VM.

## Next steps
1. User, in PowerShell from `C:\Users\regan\source\repos\no-dumb-zone`: `git push`. If `git status` shows `LICENSE` modified there too, `git checkout -- LICENSE`; it is line endings, not content.
2. User: upload `dist\no-dumb-zone-plugin.zip` under Customize > Plugins, replacing 0.2.2. Until then Cowork tasks run 0.2.2, which has no carry-over.
3. First turn of the next Cowork task: `/no-dumb-zone:limit show` should print version-agnostic output as before; confirm the skill text in the task's synced copy mentions "carries" (`grep carries ~/.claude/plugins/synced/*/no-dumb-zone/scripts/ndz-limit.js` in the workspace shell) to prove 0.2.3 is the loaded copy.
4. Optional end-to-end carry test in Cowork: in a task with this folder connected, `/no-dumb-zone:limit 20000`, work until the handoff fires (20k is above the test-sized cutoff, so it carries), check the handoff's second line ends with `Then /no-dumb-zone:limit 20000.`, start a new task with that line, and `/no-dumb-zone:limit show` there should say 20,000 from the limit file.
5. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
6. Carry over from v0.1: use the plugin on InkBook for a day, then decide nag frequency (every stop vs every third), auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: deferred until after a day of real use.
- Cowork names the chat from the whole first message; with the carry suffix the name may get longer. If that is ugly, the pickup hook could strip it, but only Cowork's own naming would need to change, and the plugin cannot do that.

## Files touched
- scripts/ndz-common.js: `TEST_SIZED_BELOW`, `parseTokens`, `limitFromPrompt`, `writeLimitFile`
- scripts/ndz-check.js: carry sentence in the Cowork exit-2 text
- scripts/ndz-pickup.js: applies `/no-dumb-zone:limit <n>` from the first Cowork prompt
- scripts/ndz-limit.js: shared parser; Cowork wording on set/show
- skills/handoff/SKILL.md: step 4 appends the carry suffix
- scripts/test.sh: cases 31 to 37b (40 total)
- README.md: carry-over paragraph, limit-file row, troubleshooting bullet
- CLAUDE.md: carry-over convention, 0.2.2 live confirmation, `$HOME=/root`, synced path shape, CRLF gotcha, 40 cases
- .claude-plugin/plugin.json: 0.2.3
- dist/no-dumb-zone-plugin.zip: rebuilt 0.2.3 (gitignored)
- NOTES.md: this file
