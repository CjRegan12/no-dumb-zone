# no-dumb-zone: 900k limit, Stop fix, dashboard pane (1)

## Done this session
- v0.4.3: terminal default limit 500k -> 900k (827f8f5). 500k filled too fast and cut long sessions off midway; 900k sits ~67k under the ~967k auto-compact point. Cowork stays 600k. test.sh updated.
- v0.4.3: mod no longer hooks classic.Stop (fc22ea7). cc-plugin-sec-default skips installed plugins' classic.Stop hooks on managed/Team/Enterprise setups, so the /clear prefill never fired. ndz-check.js now writes handoff-<id>.done at the stop that ends the handoff turn; the mod reads markers on turn.complete and session.measure.
- CJ pushed and uploaded 0.4.3.
- v0.4.4: dashboard pane (663d879): /ndz dash, band Dashboard button, auto-opens once at 80% (not in Cowork). Gauge, per-turn growth sparkline, turns-left estimate, status, Handoff now (hotkey h), limit Select writing $CLAUDE_PLUGIN_DATA/limit. dist zip rebuilt as 0.4.4. 13/13 mod tests, 58/58 test.sh, tsc clean.

## Decisions and why
- CJ asked for 1M; went with 900k because at 1M the Stop hook never fires before auto-compact.
- Dashboard over "better band" or "handoff viewer": CJ picked the dashboard pane.
- Version 0.4.4, not 0.5.0, since 0.5.0 was the reverted North Star.

## Next steps
1. CJ: `git push` from C:\Users\regan\source\repos\no-dumb-zone, then upload dist\no-dumb-zone-plugin.zip (Customize > Plugins > Upload). 0.4.4 is committed but not pushed or uploaded.
2. In a fresh terminal session, run a few turns and `/ndz dash`; check the pane actually draws well (only tested in the test kit, never seen on screen). Adjust hooks/register.ts Pane render if layout is off.
3. This Cowork task's Stop hook fired at a 250,000 limit from the old synced copy (no-dumb-zone/, not ~g2), so this long-running task still had an old version mounted; a fresh task should show 600k.

## Open questions for the user
- None.

## Files touched
- scripts/ndz-common.js, hooks/register.ts: terminal default 900000
- scripts/ndz-check.js: writes handoff-<id>.done at the handoff turn's stop
- hooks/register.ts: turn.complete instead of classic.Stop; dashboard pane
- tests/ndz-mod.test.ts, scripts/test.sh: updated and new tests
- README.md, CLAUDE.md, skills/limit/SKILL.md, scripts/ndz-limit.js: docs for 900k, markers, dashboard
- .claude-plugin/plugin.json: 0.4.4
