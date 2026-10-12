# no-dumb-zone: North Star v0.5.0 rollout (1)

## Done this session
- Built North Star into NDZ as v0.5.0, committed as 9b1fb1f: `scripts/ndz-northstar.js` (UserPromptSubmit + Stop), `skills/northstar/SKILL.md` (setup / phase / rule / show / drift), handoff skill step 2b (Ledger line + drift score), mod band shows `★ <## Now>`, README section, `scripts/test-northstar.js` (39/39 pass). Old `bash scripts/test.sh` still 55/55; `claude plugin validate .` passes.
- Prior-art check: claude-reflect (1.6k stars) auto-captures corrections but needs manual /reflect review, writes CLAUDE.md, terminal only, no intent. vikrantjain/intent writes intent.md but never checks work against it. Intent + enforcement + cross-surface Ledger + drift score was not found anywhere.
- Wrote a DRAFT `C:\Users\regan\source\repos\propfein\NORTHSTAR.md` with every inferred line marked `(guess)`. Waiting on CJ to confirm.

## Decisions and why
- North Star ships inside NDZ, not as its own plugin: NDZ keeps Claude sharp, North Star keeps it on target. One plugin, one story, same hook setup that already fires in both terminal and Cowork.
- Came from CJ's three pains: Cowork days behind the terminal, repeating corrections, Claude grinding to "tests pass" with no quality bar.
- Correction detection is regex, loose on purpose; Claude decides standing vs one-off, and the Stop hook blocks only once per correction.
- Cowork Ledger lines are written by Claude (hooks there cannot touch the device folder). Terminal Ledger lines are automatic.

## Next steps
1. Get CJ's answers to the 3 Propfein questions (Now, Not yet, Bar; draft lines are in propfein/NORTHSTAR.md marked `(guess)`), then rewrite that file without the `(guess)` markers.
2. Package and install 0.5.0: Cowork upload zip per CLAUDE.md "Package for Cowork" (python zipfile from the VM, posix entry names), and terminal reinstall. Bump nothing; it is already 0.5.0.
3. First live test in a real Propfein session: correct Claude on something ("no, I told you ..."), confirm a `## Rules` line lands in NORTHSTAR.md, and in the terminal confirm the Ledger line appears after an edit. Then run `/no-dumb-zone:northstar drift` once.
4. Suggest `git init` in propfein: drift and Cowork catch-up both lean on git history, and the folder has none.
5. Fix what the live test shows; likely candidates are false-positive corrections and the Cowork Ledger line being skipped.

## Open questions for the user
- Propfein Now: closing-line capture on a schedule + sigma calibration from box scores?
- Propfein Not yet: no public signups/payments, no new sports for now?
- Propfein Bar: numbers checked against a real source; every bet traceable to its inputs; nothing ships untested against the real Supabase data shape. Right, or what's missing?

## Files touched
- scripts/ndz-northstar.js: new, the North Star hook (prompt anchoring, correction capture, Ledger)
- scripts/test-northstar.js: new, 39 simulated cases
- skills/northstar/SKILL.md: new skill
- skills/handoff/SKILL.md: step 2b, NORTHSTAR.md staged in the commit
- hooks/hooks.json: northstar script on UserPromptSubmit and Stop
- hooks/register.ts: band and /ndz show the current phase
- .claude-plugin/plugin.json: 0.5.0, new description and keywords
- README.md: North Star section
- CLAUDE.md: North Star test command and conventions
- (outside this repo) propfein/NORTHSTAR.md: draft, unconfirmed
