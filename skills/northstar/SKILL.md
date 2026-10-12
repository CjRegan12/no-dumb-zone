---
name: northstar
description: Set up, update, show or score the project's North Star (NORTHSTAR.md), the file that holds what the user wants - vision, current phase, quality bar, standing rules and a ledger of sessions across terminal and Cowork. Use when the user says set up north star, what are we building, change the phase, we're moving on to, add a rule, show the north star, or check drift / how far did this drift.
argument-hint: "[setup | phase <text> | rule <text> | show | drift]"
allowed-tools: Read, Edit, Write, Bash(git log *), Bash(git diff *), Bash(git status *), mcp__remote-devices__device_bash
---

NORTHSTAR.md is the user's file, not yours. It holds what THEY want, in their words. Your job is to help them write it and keep it current, never to fill it with your own opinions.

## Where it lives

- Terminal: the project root (current working directory).
- Cowork: the root of the connected project folder, `$HOME/mnt/<folder>/NORTHSTAR.md`, read and written through the device shell. If no project folder is connected, say so and stop.

## The format

Keep these headings exactly; the hooks read them by name.

```markdown
# <project>: north star

## Vision
What this is, who it is for, what makes it worth building. 2 to 4 lines.

## Now
The current phase: what we are building right now. 1 to 3 lines.

## Not yet
What is deliberately out of scope for this phase. Bullets.

## Bar
What good means on this project, the things that make work "done" beyond passing tests. Bullets.

## Rules
- YYYY-MM-DD: a standing correction, in the user's words

## Ledger
- YYYY-MM-DD · terminal|cowork · what got done · touched: files
```

The whole file stays under 6,000 characters. The Ledger keeps the newest 30 lines.

## Modes

Read the argument. No argument: `show` if the file exists, `setup` if it does not.

### setup

1. Gather what already exists, quietly: README, CLAUDE.md, NOTES.md, `git log --oneline -20`. Do not ask what you can read.
2. Draft Vision, Now, Not yet and Bar from that. Mark every line you inferred rather than read with `(guess)`.
3. Show the draft and ask the user to fix it, in at most three short questions, only about what you could not tell. The Bar matters most: ask what "done well" means to them on this project if nothing says.
4. Write the file with their answers. Remove every `(guess)` they confirmed; drop any they did not. Leave Rules and Ledger empty.
5. Reply in one line: `North Star set. Now: <phase>.`

### phase <text>

Moving to a new phase. Replace `## Now` with their text. Ask once whether anything in `## Not yet` is now in scope, and move it out if so. Add a Ledger line: `- <date> · <surface> · phase changed: <old> -> <new>`. Reply in one line.

### rule <text>

Add `- <date>: <text>` under `## Rules`, their words exactly. If an existing rule says the same thing, update it instead of adding. If a new rule contradicts an old one, replace the old one and say which.

### show

Print Now, Not yet, Bar and Rules, then the newest 5 Ledger lines. Nothing else.

### drift

Score how far the recent work drifted from what the user wants.

1. Work out the span: this session's changes (`git diff` plus uncommitted work), or, if the user names one, that range of commits or ledger lines.
2. Check that work against each part of the file:
   - **Scope**: anything built that `Not yet` lists, or that `Now` does not cover.
   - **Bar**: each Bar line, met or not, with the evidence (a test, a file, a command result).
   - **Rules**: each rule, followed or broken, with file and line where broken.
3. Score drift 0 to 10. 0 means everything served Now, met the Bar and kept every Rule. Each piece of out-of-scope work, unmet Bar line or broken Rule adds to it; a broken Rule counts most, because the user already asked once.
4. Reply in this shape, nothing more:

```
Drift: <n>/10 - <one-line verdict>
Off scope:   <item> (file)          or: none
Bar:         <met>/<total>, missing: <what>
Rules broken: <rule> at file:line   or: none
Fix first:   <the single most important thing>
```

5. Append ` · drift <n>/10` to this session's Ledger line (add the line if it is not there).

Be honest. A low score earned by skipping checks is worse than a high one with evidence. If you could not verify something, say so in that row rather than counting it as met.
