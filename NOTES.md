# no-dumb-zone: v0.2.0 Cowork mode (2)

## Done this session
- Diagnosed why new Cowork chats went hunting for context: Cowork tasks run the hooks in a cloud container (cwd `/home/claude`); the project folder is on CJ's PC and only reachable through device tools, so the pickup hook could never see `NOTES.md`, and the handoff wrote into the wrong place unless Claude happened to use the device shell. Separate issue: Cowork names chats from the first message and ignores `sessionTitle`.
- Found the surface signal: `CLAUDE_CODE_ENTRYPOINT=remote_cowork` is set inside Cowork tasks (read from a live one). Added `isCowork()` to `ndz-common.js` with an `NDZ_SURFACE` override.
- `ndz-check.js`: exit-2 instruction now says `Surface: Cowork|terminal`; in Cowork it tells Claude the project is a connected folder on the user's computer. Post-handoff nag says "new task" in Cowork, "/clear" in the terminal.
- `ndz-pickup.js`: in Cowork with no local `NOTES.md`, injects context telling Claude to read `$HOME/mnt/<folder>/NOTES.md` from the device; no `sessionTitle`.
- `SKILL.md`: new step 0 (find the project root per surface), Cowork git notes (inline identity, lock files), and a two-line Cowork ending that hands the user a paste-ready first message so Cowork names the chat.
- Tests 17 to 21 added; 22 pass in the Cowork VM. README gained a Terminal vs Cowork table and the `tar -a` packaging command (Compress-Archive removed). Version 0.2.0. `dist/` gitignored.
- Committed as `7056669`, git lock files cleaned (needed delete permission on the folder), and `dist/no-dumb-zone-plugin.zip` built (10 entries, forward-slash paths). Not yet uploaded.
- The 0.1.0 synced Stop hook fired in this very chat at 291k tokens and said `/clear`; this handoff was written by hand to the connected folder, which is exactly what 0.2.0 automates.

## Decisions and why
- Branch on `CLAUDE_CODE_ENTRYPOINT`, not `CLAUDE_CODE_REMOTE`: the latter is also true for Claude Code on the web, where the repo is on disk and the terminal path is right.
- Pickup in Cowork injects a pointer rather than trying an `mcp_tool` hook against `device_bash`: an mcp_tool hook cannot check the once-per-session marker and would re-fetch the notes on every prompt.
- Keep the pasted-first-line workaround for naming rather than fighting Cowork's auto-title: there is no hook path to it.

## Next steps
1. Upload `dist/no-dumb-zone-plugin.zip` under Customize > Plugins (replace the existing no-dumb-zone). Running sessions keep 0.1.x; new tasks get 0.2.0. Until then every Cowork chat still loads 0.1.0 and its `/clear` wording.
2. Live test in Cowork: new task in this folder, first message `no-dumb-zone: v0.2.0 Cowork mode (2). Continue from NOTES.md.` Expect Claude to read this file from `$HOME/mnt/no-dumb-zone/NOTES.md` on its first turn and answer "what's next" from it without searching.
3. Then force a Cowork handoff with a low limit (`NDZ_LIMIT` can't be set from inside Cowork, so either run a long task or temporarily lower `DEFAULT_LIMIT` in `ndz-check.js` for the test build) and confirm the skill writes `NOTES.md` into the connected folder and ends with the two-line Cowork message.
4. Carry over from v0.1: use it on InkBook for a day, decide nag frequency (every stop vs every third), decide auto-commit vs stage-only, decide whether project repos commit `NOTES.md` or gitignore it.
5. Move the GateGuard gotcha into `C:\Users\regan\.claude\CLAUDE.md`.
6. Rename `master` to `main`, push to GitHub (`gh repo create no-dumb-zone --public --source . --push`), optional `marketplace.json`.

## Open questions for the user
- Should the Cowork pickup context fire in every Cowork task (current), or stay quiet unless the first message mentions NOTES.md? Every task is one short paragraph once; quiet would miss the case where the user forgets to paste the line.
- Nag frequency, auto-commit vs stage, commit-or-ignore `NOTES.md`: still open from v0.1.

## Files touched
- scripts/ndz-common.js: `isCowork()` + export
- scripts/ndz-check.js: surface in exit-2 text, surface-specific nag
- scripts/ndz-pickup.js: Cowork branch with device-folder pointer
- scripts/test.sh: `NDZ_SURFACE=terminal` pinned, cases 17 to 21, headers renamed to .js
- skills/handoff/SKILL.md: step 0, Cowork git notes, two-line Cowork ending, device_bash in allowed-tools
- README.md: Terminal vs Cowork section, tar packaging, troubleshooting entry, scope notes
- CLAUDE.md: test count, packaging path, surface detection + Cowork shape facts, lock-file cleanup command
- .claude-plugin/plugin.json: 0.2.0
- .gitignore: dist/
- NOTES.md: this file
