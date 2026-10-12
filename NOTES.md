# no-dumb-zone: North Star v0.5.0 rollout (2)

## Done this session
- 2026-10-12: CJ answered the Propfein questions. Rewrote `propfein/NORTHSTAR.md` with no `(guess)` markers: Now left EMPTY on purpose (he wants closing-line capture and sigma calibration eventually but has not picked what is current); Not yet keeps no signups/payments and no new sports/bet types (he wants both later, which is what Not yet means); Bar keeps "checked against a real source" and "tested against real Supabase / DEPLOY.txt", drops "every bet traceable".
- Built `dist/no-dumb-zone-plugin.zip` for 0.5.0 (16 files, posix names, includes skills/northstar). Tests re-run first: northstar 39/39, test.sh 55/55.
- Earlier (rollout 1, commit 9b1fb1f): North Star built into NDZ as v0.5.0 (hook, skill, handoff step 2b, band, README, tests). Prior art checked: nothing combines intent + enforcement + cross-surface Ledger + drift score.

## Decisions and why
- North Star ships inside NDZ, not as its own plugin: NDZ keeps Claude sharp, North Star keeps it on target. One plugin, one story, same hook setup that already fires in both terminal and Cowork.
- Came from CJ's three pains: Cowork days behind the terminal, repeating corrections, Claude grinding to "tests pass" with no quality bar.
- Correction detection is regex, loose on purpose; Claude decides standing vs one-off, and the Stop hook blocks only once per correction.
- Cowork Ledger lines are written by Claude (hooks there cannot touch the device folder). Terminal Ledger lines are automatic.

## Next steps
1. CJ uploads `dist\no-dumb-zone-plugin.zip` under Customize > Plugins > Add > Upload plugin (replaces 0.4.x; syncs to the terminal as no-dumb-zone@synced). Start a FRESH task after, not a running one (re-sync gotcha in CLAUDE.md).
2. First live test in a real Propfein session: correct Claude on something ("no, I told you ..."), confirm a `## Rules` line lands in NORTHSTAR.md; in the terminal confirm the Ledger line appears after an edit. Then run `/no-dumb-zone:northstar drift` once.
3. Watch how an empty `## Now` behaves live: the hook skips it (steeringText drops empty sections) and the band shows no star. When CJ picks a phase: `/no-dumb-zone:northstar phase <text>`.
4. `git init` in propfein if CJ agrees: drift and Cowork catch-up lean on git history.
5. Fix what the live test shows; likely false-positive corrections and the Cowork Ledger line being skipped.

## Open questions for the user
- Propfein Now: which comes first, closing-line capture or sigma calibration (or something else)?
- OK to `git init` propfein?

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
- (outside this repo) propfein/NORTHSTAR.md: confirmed by CJ 2026-10-12, Now empty until he picks
