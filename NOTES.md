# no-dumb-zone: v0.3 defaults (2)

## Done this session
- 0.3.0 closed: `main` == `origin/main`, the synced copy was 0.3.0, `/no-dumb-zone:limit show` printed `600,000 tokens (the Cowork default)` on the first turn. Second baseline sample: 132,249 tokens at the first assistant message (first was 131,846), everything still on.
- 0.3.1 (`9aabb82`): the handoff skill's Cowork step stages with `git -c core.autocrlf=input add -A` so the CRLF phantom (`LICENSE`) never lands in a handoff commit; proven in the VM, pinned as test cases 43/43b (47 pass), zip validated in the container. CJ pushed and uploaded 0.3.1. The upload re-synced into this running task as `no-dumb-zone~g2`, and the Stop hook and handoff skill that wrote this file ran from the 0.3.1 copy, so the autocrlf staging is live-tested by this very commit.
- Carry test, emit half, again: `/no-dumb-zone:limit 170000` set in-task, the hook fired at 213,419 tokens with the carry sentence, and this handoff's paste line ends with `Then /no-dumb-zone:limit 170000.`
- Baseline cut blocked: plugin and connector toggles are account-wide and CJ had other sessions running. Checked the transcript: the skills list is in the system prompt, not re-sent per turn; connector tools are mostly deferred. Noted in CLAUDE.md.

## Decisions and why
- autocrlf flag over stage-by-name for the Cowork handoff: deterministic, and it keeps `git add -A`'s "nothing is lost" guarantee at the moment Claude is most likely to forget a file. Safe for CRLF-committed repos (git skips the conversion when the index blob has CRLF). Terminal keeps plain `git add -A` (Windows git has autocrlf=true; `Bash(git add *)` would not match `git -c ...`).
- 170k for the carry test: just above this task's context so it fired on the next stop; >= 10k so it is carried; the next task starts near 132k, so it runs ~38k of work before firing. It must be cleared there.

## Next steps
1. Pickup half of the carry test, first turn of this task: run `/no-dumb-zone:limit show`. Pass: `170,000 tokens` with the source `limit file: /root/.claude/plugins/data/no-dumb-zone-synced/limit`, and the pickup context on this first prompt said it applied the limit from the message. Fail: `600,000 tokens (the Cowork default)`, meaning `ndz-pickup.js` `limitFromPrompt` did not catch `Then /no-dumb-zone:limit 170000.` in a real task although headless did; then check the first prompt's exact text in `~/.claude/projects/*/*.jsonl` (first `type: "user"` line) against `parseTokens` in `ndz-common.js`. Record pass or fail in CLAUDE.md's carry-over convention line ("Verified with a headless..."). Either way, run `/no-dumb-zone:limit clear` right after, or this task hands off at 170k.
2. Baseline cut, only when CJ has no other sessions running: turn off Figma, Vercel, Supabase and the unused bundles (product-management, design, engineering, marketing, productivity, figma, cowork-plugin-management; anthropic-skills too for the floor), start a task in this folder with the first message `no-dumb-zone: baseline cut (1). Connectors and plugin bundles are off for this task. Measure this task's first assistant message context with the command in CLAUDE.md, compare with the 131,846 and 132,249 before-numbers in NOTES.md, record the result in CLAUDE.md's baseline gotcha and in NOTES.md, commit.` Expect a drop toward 90-100k.
3. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
4. Use the plugin on InkBook for a day, then decide nag frequency, auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.
5. User, PowerShell: `git push` after this handoff commit (the VM cannot reach GitHub).

## Open questions for the user
- After a week at 600k in Cowork: any sign of the dumb zone (wrong file edits, forgotten constraints, repeated mistakes late in a task)? If yes, the data says 400k; `/no-dumb-zone:limit 400k` carries from task to task without a re-upload.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred.

## Files touched
- CLAUDE.md: baseline gotcha extended (skills list in the system prompt, account-wide toggles), new gotcha that the VM cannot reach GitHub
- NOTES.md: this file
- Container only, not on disk: `/root/.claude/plugins/data/no-dumb-zone-synced/limit` = 170000, carried by the paste line
