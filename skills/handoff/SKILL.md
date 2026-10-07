---
name: handoff
description: Write the session handoff before clearing context. Updates CLAUDE.md with durable learnings, writes NOTES.md with task state and next steps, commits, then tells the user to /clear. Use when the no-dumb-zone Stop hook asks for it, when context is near its limit, or when the user says to hand off, wrap up the session, or save state before clearing.
allowed-tools: Read, Edit, Write, Bash(git status *), Bash(git add *), Bash(git commit *), Bash(git log *), Bash(git diff *), Bash(git branch *)
---

You are handing this session off to a fresh one that will not see this conversation. Everything the next session needs has to be on disk. Do the four steps below in order. Be brief. Do not start new work, do not run tests, do not refactor.

## 1. CLAUDE.md: durable facts only

Open the project's `CLAUDE.md` (create it if missing). Add only things that will still be true next month and that Claude could not work out by reading the code:

- commands that are not obvious (build, test, run, deploy, migrate)
- environment quirks and required env vars
- conventions this project follows that differ from defaults
- architectural decisions and the reason behind them
- gotchas that cost time this session

Do not add task state, progress, or anything dated. If a line you would add is already there, skip it. If an existing line is now wrong, fix it. Keep the file short.

## 2. NOTES.md: task state, overwrite it

Write `NOTES.md` in the project root, replacing any existing one, in exactly this shape:

```markdown
# <project>: <task in a few words> (<n>)

## Done this session
- ...

## Decisions and why
- ...

## Next steps
1. <concrete enough to start cold, name the file and the change>
2. ...

## Open questions for the user
- ...

## Files touched
- path/to/file: one line on what changed
```

Rules for the title line:

- `<project>` is the repo folder name.
- `<task>` is the current workstream, not the whole project.
- `<n>` is a counter. If the previous NOTES.md title ended in `(n)` for the same task, write `(n+1)`. New task, or no previous notes: `(1)`.
- Keep it under 80 characters. The next session is named from this line.

Keep the whole file under 8,000 characters. The first next step matters most: the next session reads it cold.

## 3. Commit

Stage `CLAUDE.md`, `NOTES.md`, and any other uncommitted work so nothing is lost:

```
git add -A
git commit -m "handoff: <task> (<n>)"
```

If the uncommitted work is clearly half-finished, still commit it, with `wip: ` in front of the message. The next session can amend. If this is not a git repo, skip this step and say so.

## 4. Stop

Reply with exactly one line:

`Handoff written: <title line>. Run /clear to start fresh.`

Then stop. Do not continue the task, do not summarize the conversation, do not ask what to do next.
