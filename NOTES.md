# no-dumb-zone: v0.3 defaults (2)

## Done this session
- Carry test, pickup half: FAIL on 0.3.1. `/no-dumb-zone:limit show` on the first turn printed `600,000 tokens (the Cowork default)`, limit file absent, and the pickup context did not say it applied anything. Not the parser: `limitFromPrompt` returns 170000 for the exact message text. Cause: the task's first turn restarted the session (the first turn called `enable__mcp__remote-devices__computer` to link the computer). Transcript lines 1-9 carry `sessionId 7463a5a2` with the user's message as line 2 and no `pickup-` marker for that id; the session continued as `8a8e3968`, whose first prompt was the harness line `Continue with the task described in the conversation above.`; the pickup fired on that (its context is transcript line 25), so `prompt` had no limit line.
- 0.3.2 (this commit): `ndz-pickup.js` falls back to `limitFromTranscript(transcript_path)` (new in `ndz-common.js`: first non-sidechain `type: "user"` line with text left after dropping tool results and `<system-reminder>` blocks, i.e. the user's first message), guarded by `otherPickupRan`: skipped when a `pickup-*` marker for another session id exists in the data dir, so a restart later in the task cannot re-apply a cleared limit. Cases 36b/36c added, 49 pass in the VM. Run against this task's real transcript in the container with a scratch data dir: limit file = 170000, context says applied.
- CLAUDE.md: carry-over convention line records the live fail and the fallback; new gotcha on first-turn session restarts; test count 49. README: one sentence on the restart case.
- The 170k from the paste line never landed, so there was nothing to clear; this task has run at the 600k default.

## Decisions and why
- Transcript fallback over "retry on every prompt": the paste line is only ever the user's first message, so reading the transcript's first real prompt keeps the contract and never catches a `/no-dumb-zone:limit` the user typed later (the skill handles those). The marker guard exists because a restart can also happen mid-task, after the user may have run `/no-dumb-zone:limit clear`; one carry per container.
- Kept the `inp.prompt` path first: it is the documented contract and the cheap path; the transcript read only happens when the prompt has no line.

## Next steps
1. User, PowerShell: `git push`, then package (`mkdir dist -Force; tar -a -c -f dist\no-dumb-zone-plugin.zip .claude-plugin/plugin.json .gitignore README.md hooks scripts skills`) and upload 0.3.2 under Customize > Plugins. Must happen before step 3: the next task's pickup has to run the new code.
2. Emit half of the carry re-test, in this task once step 1 is done: `/no-dumb-zone:limit 170000` (above the ~132k baseline, below this task's context), so the next stop hands off with `Then /no-dumb-zone:limit 170000.` on the paste line.
3. Pickup half, next task, first turn: `/no-dumb-zone:limit show`. Pass: `170,000 tokens`, source `limit file: /root/.claude/plugins/data/no-dumb-zone-synced/limit`, whether or not that task's first turn restarted the session (a second `sessionId` in `~/.claude/projects/*/*.jsonl` says it did). Fail: 600,000; then run the synced `ndz-pickup.js` by hand in the workspace shell against that task's transcript with a scratch `CLAUDE_PLUGIN_DATA` and the harness prompt, as done this session, and compare. Record in CLAUDE.md's carry-over line, then `/no-dumb-zone:limit clear` or that task hands off at 170k.
4. Baseline cut, only when CJ has no other sessions running: turn off Figma, Vercel, Supabase and the unused bundles (product-management, design, engineering, marketing, productivity, figma, cowork-plugin-management; anthropic-skills too for the floor), start a task in this folder with the first message `no-dumb-zone: baseline cut (1). Connectors and plugin bundles are off for this task. Measure this task's first assistant message context with the command in CLAUDE.md, compare with the 131,846 and 132,249 before-numbers in NOTES.md, record the result in CLAUDE.md's baseline gotcha and in NOTES.md, commit.` Expect a drop toward 90-100k.
5. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
6. Use the plugin on InkBook for a day, then decide nag frequency, auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- After a week at 600k in Cowork: any sign of the dumb zone (wrong file edits, forgotten constraints, repeated mistakes late in a task)? If yes, the data says 400k; `/no-dumb-zone:limit 400k` carries from task to task without a re-upload.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred.

## Files touched
- scripts/ndz-common.js: `limitFromTranscript`, exported
- scripts/ndz-pickup.js: `otherPickupRan` guard, transcript fallback, header comment
- scripts/test.sh: cases 36b, 36c
- .claude-plugin/plugin.json: 0.3.2
- CLAUDE.md, README.md, NOTES.md: as above
