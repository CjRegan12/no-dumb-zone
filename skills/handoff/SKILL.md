---
name: handoff
description: Write the session handoff before clearing context. Updates CLAUDE.md with durable learnings, writes NOTES.md with task state and next steps, commits, then tells the user how to start the fresh session. Use when the no-dumb-zone Stop hook asks for it, when context is near its limit, or when the user says to hand off, wrap up the session, or save state before clearing.
allowed-tools: Read, Edit, Write, Bash(git status *), Bash(git add *), Bash(git commit *), Bash(git log *), Bash(git diff *), Bash(git branch *), mcp__remote-devices__device_bash
---

You are handing this session off to a fresh one that will not see this conversation. Everything the next session needs has to be on disk, in the project folder. Do the four steps below in order. Be brief. Do not start new work, do not run tests, do not refactor.

## 0. Find the project root

The Stop hook message names the surface. Everything below is written there and nowhere else.

- **Terminal, VS Code, Claude Code on the web** (`Surface: terminal`): the project root is the current working directory. Use Read, Edit, Write and Bash as usual.
- **Cowork** (`Surface: Cowork`): the project folder is a connected folder on the user's computer, mounted at `$HOME/mnt/<folder>` in the device shell (`device_bash`). Do every file write and every git command through that shell, in that folder. Nothing written into this workspace's own home directory survives the task. If no project folder is connected, skip steps 1 to 3 and say so in the final line.

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

Cowork only: if git refuses for lack of an identity, take it from the last commit (`git log -1 --format='%an <%ae>'`) and pass it inline with `git -c user.name=... -c user.email=... commit ...`. Committing from the device shell can leave `.git/index.lock` or `.git/objects/*/tmp_obj_*` behind; if `git status` afterwards complains about a lock, delete those files, and if deletion is not permitted, name them in the final line so the user can.

## 4. Stop

**Terminal.** Reply with exactly one line:

`Handoff written: <title line>. Run /clear to start fresh.`

**Cowork.** Cowork names a chat from its first message and ignores hook titles, so the user's first message has to carry the title. Reply with exactly these two lines and nothing else:

`Handoff written: <title line>. Start a new task in this folder and paste the next line as your first message.`
`<title line>. Continue from NOTES.md.`

Then stop. Do not continue the task, do not summarize the conversation, do not ask what to do next.
