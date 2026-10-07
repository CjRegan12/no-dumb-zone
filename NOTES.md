# no-dumb-zone: v0.1.0 shipped, first real use (1)

## Done this session
- Designed the plugin from the plan doc (https://claude.ai/code/artifact/c8ac9c05-5e0a-4920-81f5-d155f31fbee5): Stop hook, PermissionRequest hook, UserPromptSubmit hook, handoff skill.
- Wrote scripts in Python, then ported to Node when CJ moved back to Windows + PowerShell.
- 17-case test suite in `scripts/test.sh`, passing in the cloud container and inside CJ's Cowork VM.
- Verified the full loop in real `claude -p` sessions: task finishes, Stop hook blocks once, skill runs, `CLAUDE.md` + `NOTES.md` written, commit, "Run /clear"; second session auto-named and briefed from notes.
- Repo on CJ's machine at `C:\Users\regan\source\repos\no-dumb-zone`, branch `master`, commits `aff7b80`, `f889bfc`.
- Live test passed in PowerShell (scratch repo, `NDZ_LIMIT=1000`, handoff commit `241cb70`). Context window is 1M, so the default 250k limit stands; no settings changes made.
- Packaged with `tar -a` and uploaded to Customize > Plugins. Synced to Cowork within minutes; the hook then fired in the build session itself at 606k tokens and produced this handoff.

## Decisions and why
- Node over Python/bash: one interpreter name that works on Windows, Linux, macOS and the Cowork VM.
- PermissionRequest hook auto-approves only `Skill(no-dumb-zone:handoff)`: without it, headless and Cowork sessions silently deny the skill call.
- No SessionEnd cleanup hook: age-based pruning in the check script is simpler.
- Left `autoCompactEnabled` on: with a 1M window it never races the 250k limit, and it is a backstop.
- Dropped `claude plugin marketplace add` from the README: the repo has no `marketplace.json`; Cowork upload covers terminal too.

## Next steps
1. Use the plugin for a day on InkBook or the agency repo. Note every time it fires at a bad moment and whether the per-stop `/clear` nag in `scripts/ndz-check.js` is too chatty (candidate change: nag every third stop).
2. Move the GateGuard gotcha line out of per-project `CLAUDE.md` files into `C:\Users\regan\.claude\CLAUDE.md`, so handoffs stop re-adding it.
3. Housekeeping on CJ's machine: delete `%TEMP%\ndz-test` and `C:\Users\regan\Downloads\no-dumb-zone.zip` (keep `no-dumb-zone-plugin.zip`).
4. Rename `master` to `main` (`git branch -m master main`), then `gh repo create no-dumb-zone --public --source . --push`.
5. Optional: add `.claude-plugin/marketplace.json` so `claude plugin marketplace add <repo>` works, then update the README install section.
6. Later ideas from the plan doc: percentage-based `NDZ_LIMIT`, PowerShell note in README, Herdr pane title from `NOTES.md` line 1.

## Open questions for the user
- Nag every stop after the handoff, or every third stop?
- Keep auto-commit in the handoff skill, or stage only and let the next session commit?
- Commit `NOTES.md` in project repos, or gitignore it?

## Files touched
- .claude-plugin/plugin.json: manifest, v0.1.0
- hooks/hooks.json: Stop, PermissionRequest (matcher Skill), UserPromptSubmit; all exec form with node
- scripts/ndz-common.js: stdin parsing, marker paths, 7-day prune, JSON emit
- scripts/ndz-check.js: context size from transcript tail, exit 2 once then systemMessage nag
- scripts/ndz-allow-handoff.js: approve Skill(no-dumb-zone:handoff) only
- scripts/ndz-pickup.js: first-prompt sessionTitle + additionalContext from NOTES.md, git-branch fallback
- scripts/test.sh: 17 unit cases against fake transcripts and hook input
- skills/handoff/SKILL.md: the handoff procedure
- README.md: install (tar zip, Cowork upload), config, troubleshooting
- CLAUDE.md: durable facts for this repo (new, this handoff)
- NOTES.md: this file
