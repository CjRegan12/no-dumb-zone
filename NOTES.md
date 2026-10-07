# no-dumb-zone: v0.3 defaults (1)

## Done this session
- v0.2 Cowork mode closed: `main` pushed, 0.2.3 confirmed as the synced copy in a fresh Cowork task, `/no-dumb-zone:limit show` version-agnostic. Carry-over emit half verified live: a 155k limit fired `ndz-check.js` at 161,373 tokens with the carry sentence and the handoff paste line ended with `Then /no-dumb-zone:limit 155000.`
- Measured a Cowork task's baseline: 131,846 tokens of context at the first assistant message, before any work. Researched where Claude degrades with context (sources in README/CLAUDE.md rationale): MRCR v2 for Opus 4.6 ~93% at 256K falling to ~76% at 1M; Dex Horthy stops at 300-400k on a 1M model; Anthropic and Chroma describe a gradient, not a cliff; Claude Code only auto-compacts native-1M models at ~967k.
- CJ chose 600k Cowork / 500k terminal defaults, knowingly above the data, for session length. Shipped as 0.3.0 (`4785668`): `defaultLimit()` in `ndz-common.js` picks by `isCowork()`; `ndz-limit.js` says "the Cowork default"/"the terminal default" and warns above the surface default; tests 38 to 42 added (45 pass in the VM, cases 1-37 untouched); README, CLAUDE.md, `skills/limit/SKILL.md`, `ndz-check.js` header updated. Verified in the live Cowork container with the real `CLAUDE_CODE_ENTRYPOINT`: `show` printed `600,000 tokens (the Cowork default)`.
- `dist/no-dumb-zone-plugin.zip` rebuilt at 0.3.0 (12 entries). Not pushed, not uploaded.

## Decisions and why
- Surface-aware defaults rather than one number: the 130k Cowork baseline would otherwise leave Cowork with half the terminal's working room. The baseline is static cached tool schema; whether it degrades the model as much as conversation history is unproven, so the Cowork default is the generous bet.
- 500k/600k over my 300k/400k recommendation: CJ's call. The plugin still prevents the real disaster (sitting at ~967k until auto-compact), and the limit can be lowered any time; in Cowork a lowered limit now carries between tasks.
- New test fixture dir is `data9`, because `data3` is already used by the carry-over cases and keeps a 1000-token limit file.

## Next steps
1. User, PowerShell in `C:\Users\regan\source\repos\no-dumb-zone`: `git push`. If `git status` shows `LICENSE` modified, `git checkout -- LICENSE` (line endings only).
2. User: upload `dist\no-dumb-zone-plugin.zip` under Customize > Plugins, replacing 0.2.3. Until then Cowork tasks run 0.2.3 with the 250k default.
3. First turn of the next Cowork task: `/no-dumb-zone:limit show` must print `600,000 tokens (the Cowork default)`; that proves 0.3.0 is the loaded copy. Then, if this task's first message ended with `Then /no-dumb-zone:limit <n>.`, the file should show that number instead and the pickup context should have said it applied it; that closes the carry test's pickup half. Either way, `/no-dumb-zone:limit clear` afterwards if a carried number is there.
4. Cut the Cowork baseline: CJ turns off Figma, Vercel and Supabase connectors and the unused plugin bundles (product-management, design, marketing, engineering, figma, productivity) for this project, starts a task, and Claude measures the first assistant message's context from `~/.claude/projects/*/*.jsonl` (command in CLAUDE.md). Expect 130k to drop toward 90-100k. Record the number in CLAUDE.md's baseline gotcha.
5. `skills/handoff/SKILL.md` step 3 still says `git add -A`; CLAUDE.md says never from the Cowork VM (CRLF phantom). Decide: leave, or stage-by-name with a `git diff --cached --stat` check. Add a test if the skill text changes.
6. User: move the GateGuard gotcha line from the per-project `CLAUDE.md` files (InkBook, agency) into `C:\Users\regan\.claude\CLAUDE.md`. Not in this repo.
7. Use the plugin on InkBook for a day, then decide nag frequency, auto-commit vs stage-only, and whether project repos commit `NOTES.md` or gitignore it.

## Open questions for the user
- After a week at 600k in Cowork: any sign of the dumb zone (wrong file edits, forgotten constraints, repeated mistakes late in a task)? If yes, the data says 400k; `/no-dumb-zone:limit 400k` carries from task to task without a re-upload.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still deferred.

## Files touched
- scripts/ndz-common.js: `DEFAULT_LIMIT` replaced by `DEFAULT_LIMIT_TERMINAL`/`DEFAULT_LIMIT_COWORK` and `defaultLimit()`; `resolveLimit` uses it
- scripts/ndz-limit.js: `DEFAULT_WORD`, surface default in show/set/clear and the above-default warning
- scripts/ndz-check.js: header comment
- scripts/test.sh: cases 24, 25, 28, 30 updated for the new numbers; 38 to 42 added (45 total)
- skills/limit/SKILL.md, README.md, CLAUDE.md: new defaults and the rationale; CLAUDE.md test count 45
- .claude-plugin/plugin.json: 0.3.0
- dist/no-dumb-zone-plugin.zip: rebuilt 0.3.0 (gitignored)
- NOTES.md: this file
