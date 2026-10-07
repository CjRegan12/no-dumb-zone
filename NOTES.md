# no-dumb-zone: v0.3 defaults (3)

## Done this session
- Carry test, pickup half: FAIL on 0.3.1. `/no-dumb-zone:limit show` on the first turn printed `600,000 tokens (the Cowork default)`, limit file absent. Not the parser (`limitFromPrompt` returns 170000 for the exact message). Cause: the task's first turn restarted the session (it called `enable__mcp__remote-devices__computer` to link the computer). Transcript lines 1-9 carry `sessionId 7463a5a2` with the user's message as line 2 and no `pickup-` marker for that id; the session continued as `8a8e3968`, whose first prompt was the harness line `Continue with the task described in the conversation above.`; the pickup fired on that, so `prompt` had no limit line.
- 0.3.2 (`f76b3d2`): `ndz-pickup.js` falls back to `limitFromTranscript(transcript_path)` (new in `ndz-common.js`: first non-sidechain `type: "user"` line with text left after dropping tool results and `<system-reminder>` blocks), guarded by `otherPickupRan`: skipped when a `pickup-*` marker for another session id exists in the data dir, so a restart later in the task cannot re-apply a cleared limit. Cases 36b/36c, 49 pass in the VM and in the container, `claude plugin validate` passes. Run against this task's real transcript in the container with a scratch data dir: limit file = 170000, context says applied.
- CLAUDE.md: carry-over line records the live fail and the fallback; new gotcha on first-turn session restarts; test count 49. README: one sentence on the restart case.
- Carry test, emit half, again: `/no-dumb-zone:limit 170000` set after the fix was committed; the Stop hook fired at 214,264 tokens with the carry sentence, so this handoff's paste line ends with `Then /no-dumb-zone:limit 170000.` NOT pushed, NOT uploaded yet: the synced copy is still 0.3.1.

## Re-test attempt, task (3) continued, 2026-10-07 16:35
- Inconclusive, not a 0.3.2 fail: `git push` was done (main = origin/main) but the upload was not; the task's synced plugin.json says 0.3.1. `/no-dumb-zone:limit show` printed 600,000 (the Cowork default), limit file absent. The first turn restarted again (sessionIds 160b12b0 then ea12e8c1, marker only for ea12e8c1).
- Hand run of the repo's 0.3.2 `ndz-pickup.js` against this task's real transcript, scratch data dir, harness prompt: limit file = 170000, context says applied. Second real transcript the fallback passes on.
- Limit left at the 600k default for this task (170k not set by hand). Next steps 1 (upload half only) and 2 still stand.

## Carry re-test on 0.3.2, task (3) continued again, 2026-10-07 17:04
- PASS. Synced plugin.json says 0.3.2. First turn restarted again (sessionIds a699f34f then e0a3707b, `pickup-` marker only for e0a3707b); `/root/.claude/plugins/data/no-dumb-zone-synced/limit` = 170000, written 17:04, and the hook context said the limit was applied from the first message. The transcript fallback works live. Recorded in CLAUDE.md's carry-over line.
- Limit cleared right after, so this task runs at the 600k Cowork default. Next steps 1 and 2 are done; 3 to 5 stand.

## Decisions and why
- Transcript fallback over "retry on every prompt": the paste line is only ever the user's first message, so reading the transcript's first real prompt keeps the contract and never catches a `/no-dumb-zone:limit` the user typed later (the skill handles those). The marker guard exists because a restart can also happen mid-task, after the user may have run `/no-dumb-zone:limit clear`; one carry per container.
- `inp.prompt` stays the first path (documented contract, cheap); the transcript is read only when the prompt has no line.

## Next steps
1. Baseline cut, only when CJ has no other sessions running: turn off Figma, Vercel, Supabase and the unused bundles (product-management, design, engineering, marketing, productivity, figma, cowork-plugin-management; anthropic-skills too for the floor), start a task in this folder with the first message `no-dumb-zone: baseline cut (1). Connectors and plugin bundles are off for this task. Measure this task's first assistant message context with the command in CLAUDE.md, compare with the 131,846 and 132,249 before-numbers in NOTES.md, record the result in CLAUDE.md's baseline gotcha and in NOTES.md, commit.` Expect a drop toward 90-100k.
2. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
3. Use the plugin on InkBook for a day, then decide nag frequency, auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- After a week at 600k in Cowork: any sign of the dumb zone (wrong file edits, forgotten constraints, repeated mistakes late in a task)? If yes, the data says 400k; `/no-dumb-zone:limit 400k` carries from task to task without a re-upload.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred.

## Files touched
- NOTES.md: this file (0.3.2 code, tests, CLAUDE.md and README changes are in `f76b3d2`)
- Container only, not on disk: `/root/.claude/plugins/data/no-dumb-zone-synced/limit` = 170000, carried by the paste line
