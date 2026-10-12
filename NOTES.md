# no-dumb-zone: North Star rolled back

## Done this session
- 2026-10-12: CJ decided to drop North Star. Reverted v0.5.0 (9b1fb1f): plugin is back to 0.4.2, handoff only (Stop hook handoff past the limit, pickup, limit skill, mod band). Removed the North Star lines from CLAUDE.md and propfein/NORTHSTAR.md.
- Rebuilt `dist/no-dumb-zone-plugin.zip` as 0.4.2 so a 0.5.0 zip cannot get uploaded by accident. 0.5.0 was never uploaded.

## Decisions and why
- CJ wants to keep his setup at the five-agents plugin plus NDZ as it was, not grow it. North Star stays in git history (9b1fb1f) if he ever wants it back: `git revert <the revert commit>`.
- Known issue it had, if it ever comes back: it acted in every project, not just ones with a NORTHSTAR.md (a correction made Claude create the file anywhere). Make it opt-in first.

## Next steps
- None open. NDZ 0.4.2 is what is installed and what is in the repo.

## Open questions for the user
- None.
