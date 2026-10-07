# no-dumb-zone: v0.3 defaults (1)

## Done this session
- v0.2 Cowork mode closed: `main` pushed, 0.2.3 confirmed as the synced copy in a fresh Cowork task, `/no-dumb-zone:limit show` version-agnostic. Carry-over emit half verified live: a 155k limit fired `ndz-check.js` at 161,373 tokens with the carry sentence and the handoff paste line ended with `Then /no-dumb-zone:limit 155000.`
- Measured a Cowork task's baseline: 131,846 tokens of context at the first assistant message, before any work. Researched where Claude degrades with context (sources in README/CLAUDE.md rationale): MRCR v2 for Opus 4.6 ~93% at 256K falling to ~76% at 1M; Dex Horthy stops at 300-400k on a 1M model; Anthropic and Chroma describe a gradient, not a cliff; Claude Code only auto-compacts native-1M models at ~967k.
- CJ chose 600k Cowork / 500k terminal defaults, knowingly above the data, for session length. Shipped as 0.3.0 (`4785668`): `defaultLimit()` in `ndz-common.js` picks by `isCowork()`; `ndz-limit.js` says "the Cowork default"/"the terminal default" and warns above the surface default; tests 38 to 42 added (45 pass in the VM, cases 1-37 untouched); README, CLAUDE.md, `skills/limit/SKILL.md`, `ndz-check.js` header updated. Verified in the live Cowork container with the real `CLAUDE_CODE_ENTRYPOINT`: `show` printed `600,000 tokens (the Cowork default)`.
- 0.3.0 closed in the next task: `main` == `origin/main`, the synced Cowork copy was 0.3.0, `/no-dumb-zone:limit show` printed `600,000 tokens (the Cowork default)` on the first turn. Second baseline sample: 132,249 tokens at the first assistant message (first was 131,846), with Figma, Vercel, Supabase and all plugin bundles still on.
- 0.3.1 (`9aabb82`): the handoff skill's Cowork step stages with `git -c core.autocrlf=input add -A` so the CRLF phantom (`LICENSE`) never lands in a handoff commit; proven in the VM (phantom not staged, real CRLF-typed edits stored LF, a CRLF-committed file left alone) and pinned as test cases 43/43b (47 pass). CLAUDE.md gotcha rewritten. `dist/no-dumb-zone-plugin.zip` rebuilt at 0.3.1 (12 entries), validated with `claude plugin validate` in the container, headless `limit show` from the zip copy OK. Committed from the VM with delete permission on, so no lock files. Not pushed, not uploaded.

## Decisions and why
- Surface-aware defaults rather than one number: the 130k Cowork baseline would otherwise leave Cowork with half the terminal's working room. The baseline is static cached tool schema; whether it degrades the model as much as conversation history is unproven, so the Cowork default is the generous bet.
- 500k/600k over my 300k/400k recommendation: CJ's call. The plugin still prevents the real disaster (sitting at ~967k until auto-compact), and the limit can be lowered any time; in Cowork a lowered limit now carries between tasks.
- New test fixture dir is `data9`, because `data3` is already used by the carry-over cases and keeps a 1000-token limit file.
- `git -c core.autocrlf=input add -A` over stage-by-name for the Cowork handoff: the handoff runs when context is nearly gone, exactly when Claude would forget a file; the flag is deterministic and `git add -A` keeps the "nothing is lost" guarantee. Safe for repos that store CRLF on purpose because git skips the conversion when the index blob already has CRLF. Terminal keeps plain `git add -A` (Windows git has autocrlf=true; `Bash(git add *)` in allowed-tools would not match `git -c ...` anyway).

## Next steps
1. User, PowerShell in `C:\Users\regan\source\repos\no-dumb-zone`: `git push` (the VM cannot reach GitHub, 403 from the proxy).
2. User: upload `dist\no-dumb-zone-plugin.zip` (0.3.1) under Customize > Plugins, replacing 0.3.0. Until then Cowork handoffs run the 0.3.0 skill text with plain `git add -A`.
3. Cut the Cowork baseline: CJ turns off Figma, Vercel and Supabase connectors and the unused plugin bundles (product-management, design, marketing, engineering, figma, productivity, cowork-plugin-management) for this project, starts a task, and Claude measures the first assistant message's context from `~/.claude/projects/*/*.jsonl` (command in CLAUDE.md). Before: 131,846 and 132,249. Expect a drop toward 90-100k. Record the number in CLAUDE.md's baseline gotcha.
4. Carry test, pickup half, still only verified headless: in some task run `/no-dumb-zone:limit 200k`, work past 200k, let the Stop hook fire, paste the two-line handoff; the next task's first turn must show `limit file ... 200,000` from `show` and the pickup context must say it applied it. Then `/no-dumb-zone:limit clear`.
5. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
6. Use the plugin on InkBook for a day, then decide nag frequency, auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- After a week at 600k in Cowork: any sign of the dumb zone (wrong file edits, forgotten constraints, repeated mistakes late in a task)? If yes, the data says 400k; `/no-dumb-zone:limit 400k` carries from task to task without a re-upload.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred.

## Files touched
- skills/handoff/SKILL.md: step 3 Cowork paragraph stages with `git -c core.autocrlf=input add -A`
- scripts/test.sh: cases 43 (git fixture: phantom CRLF file, real edits, CRLF-committed file) and 43b (skill text carries the command); 47 total
- CLAUDE.md: CRLF gotcha rewritten around the flag; test count 47
- .claude-plugin/plugin.json: 0.3.1
- dist/no-dumb-zone-plugin.zip: rebuilt 0.3.1 (gitignored)
- NOTES.md: this file
