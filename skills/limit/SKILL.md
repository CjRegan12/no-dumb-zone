---
name: limit
description: Set, show or clear the no-dumb-zone token limit, the context size that triggers the handoff, and show how full the context is against it. Use when the user asks to change, lower, raise, check or reset the handoff limit, asks how much context is used or how close the handoff is, wants the handoff to fire sooner or later, or wants to test the handoff on the next stop. Works in the terminal and inside a Cowork task.
argument-hint: "[tokens | show | clear]"
allowed-tools: Bash(node *)
---

Run exactly this command with the Bash tool, then stop and relay its output to the user in one or two plain lines. Do not paraphrase numbers.

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/ndz-limit.js" --data-dir "${CLAUDE_PLUGIN_DATA}" --session "${CLAUDE_SESSION_ID}" $ARGUMENTS
```

What the argument means:

- a token count such as `100000`, `100k` or `0.5m`: write it to the plugin's `limit` file. The Stop hook uses it from the next stop on, unless `NDZ_LIMIT` is set in the environment, which always wins.
- `show`, or no argument: print the limit the Stop hook will use and where it comes from, plus the session's current context against it (`context now: 310,000 tokens, 52% of the limit`). This is the meter for a Cowork task, where the plugin draws nothing.
- `clear`: delete the file and go back to `NDZ_LIMIT` or the default: 500,000 in the terminal, 600,000 in Cowork.

Rules:

- Check the command before you run it. The three quoted values after `node`, `--data-dir` and `--session` must be real: two absolute paths and a session id. If any of them still reads as a dollar sign and braces around a name in capitals, you are looking at the raw skill file and the shell would expand it to nothing (`Cannot find module '/scripts/ndz-limit.js'`). Do not run it and do not fill the values in by hand: launch this skill again through the Skill tool (`no-dumb-zone:limit`, same argument), which fills them in, and run the command it gives you.
- Use the Bash tool (the workspace shell), never the device shell. The hooks run where this command runs; a file written on the user's computer is never read.
- Do not write or edit the `limit` file by hand and do not guess its path. The command above already carries the right directory.
- If the command exits non-zero, show the user its stderr and stop.
- In a Cowork task the file lives in the task's container and disappears when the task ends. Say so if the user seems to expect it to stick.
