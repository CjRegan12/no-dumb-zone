# no-dumb-zone: v0.2 Cowork mode (7)

## Done this session
- Steps 1 to 3 of the previous notes verified in a fresh Cowork task: `main` is in sync with `origin/main` (user pushed); the synced copy in the task container is 0.2.3 (`"version": "0.2.3"`, `carries` present in `scripts/ndz-limit.js`, `limitFromPrompt` in `ndz-common.js` and `ndz-pickup.js`); `/no-dumb-zone:limit show` printed `250,000 tokens (the default)`, limit file `/root/.claude/plugins/data/no-dumb-zone-synced/limit (absent)`, `NDZ_LIMIT: unset`. The pickup marker for the session was in the data dir, no limit file, as expected for a first prompt with no carry sentence.
- Measured this task's context from the transcript: 131,846 tokens at the first assistant message (before any work), 156,014 after reading the repo. A Cowork task's baseline is ~130k.
- Step 4, the end-to-end carry test, is half done: `/no-dumb-zone:limit 155k` via the skill wrote the file (`set to 155,000 tokens (was 250,000, the default)`, Cowork wording said the paste line carries it). On the next stop `ndz-check.js` fired exit 2 at 161,373 tokens with the carry sentence: `Limit carry-over: ... end the second line of the handoff with " Then /no-dumb-zone:limit 155000." and the next task keeps it.` This handoff is the emit half of the test. The pickup half happens in the task that reads this file.
- Deletion was approved for the repo folder before the handoff; git locks cleared after the commit.

## Decisions and why
- Test limit 155k, not the 20k the previous notes suggested: a Cowork task is already ~130k before Claude's first turn, so 20k would re-fire the handoff at the end of every following task's first turn, and the carry would make that permanent. 155k fires in this task (161k at stop) and leaves ~25k of headroom in the next one.
- Staged by name, not `git add -A`, per the CRLF gotcha in CLAUDE.md, even though `LICENSE` showed clean this time.

## Next steps
1. This task IS the pickup half of the carry test. If your first message ended with `Then /no-dumb-zone:limit 155000.`, the pickup hook should already have written the limit file and said so in its context. Run `/no-dumb-zone:limit show` now: it must print `155,000 tokens` with source the limit file (`/root/.claude/plugins/data/no-dumb-zone-synced/limit`). That closes 0.2.3's carry-over end to end. If it prints 250,000 default instead, the carry failed: check `ndz-pickup.js` `limitFromPrompt` against the exact first prompt (`cat ~/.claude/projects/*/*.jsonl | head -c 4000` shows it) and whether `ndz-common.js` `writeLimitFile` ran.
2. Then `/no-dumb-zone:limit clear` in the same turn, so the task runs on the 250k default and the chain stops here. Record the result (pass or fail, exact `show` output) in NOTES.md.
3. Decide whether `skills/handoff/SKILL.md` step 3 should keep `git add -A`. CLAUDE.md says never `git add -A` from the Cowork VM (CRLF phantom on files checked out on Windows); the skill says `git add -A`. Options: leave it (the phantom only bites when a CRLF file is dirty in the index), or change step 3 to `git add -A` then `git diff --cached --stat` and unstage line-ending-only files. Small change, add a test case if the skill text changes.
4. Consider whether the pickup hook should refuse a carried limit that is below the surface's baseline (Cowork ~130k). It cannot read the transcript at UserPromptSubmit time, so the only options are a hard floor constant for Cowork or leaving it to the user. Leaning: leave it, document it (done in CLAUDE.md). Decide and close.
5. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
6. Carry over from v0.1: use the plugin on InkBook for a day, then decide nag frequency (every stop vs every third), auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.
7. If anything in this repo changes: bump `.claude-plugin/plugin.json`, `bash scripts/test.sh` (40 cases), rebuild `dist/no-dumb-zone-plugin.zip` (python zipfile from the VM, `tar -a` on Windows), user re-uploads under Customize > Plugins, user `git push` from PowerShell (the VM gets a 403).

## Open questions for the user
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred until after a day of real use.
- Cowork names the chat from the whole first message; this handoff's paste line now carries the limit suffix. Is the resulting chat name acceptable?
- Should the plugin stop a Cowork limit below ~130k from carrying (step 4 above), or is documenting it enough?

## Files touched
- CLAUDE.md: command to measure live context from the transcript; gotcha on the ~130k Cowork baseline and carried-limit chains; data-dir gotcha now says confirmed on 0.2.2 and 0.2.3
- NOTES.md: this file
