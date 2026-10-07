"use strict";
/**
 * no-dumb-zone Stop hook.
 *
 * Runs every time Claude finishes a turn. Reads the current context size from
 * the session transcript and, once it passes NDZ_LIMIT:
 *
 *   first time  -> exit 2 with an instruction to run /no-dumb-zone:handoff.
 *                  Exit 2 on Stop means Claude keeps going and does it.
 *   after that  -> exit 0 with a systemMessage nagging you to /clear.
 *
 * It never fires mid-task because Stop only fires when Claude has stopped.
 * It never fires inside subagents, and never on the turn the handoff itself runs.
 *
 * Limit, first one that parses wins:
 *   NDZ_LIMIT                   env var. Terminal only; Cowork tasks cannot set env.
 *   $CLAUDE_PLUGIN_DATA/limit   a file holding one number, written by the
 *                               /no-dumb-zone:limit skill (ndz-limit.js). The
 *                               only knob a Cowork task can turn on itself.
 *   500000 / 600000             default, terminal / Cowork (ndz-common.js
 *                               defaultLimit). Set your limit below the
 *                               auto-compact point or this never runs.
 */

const fs = require("fs");
const {
  readHookInput,
  contextTokens,
  markerPath,
  pruneOldMarkers,
  emit,
  isCowork,
  resolveLimit,
  TEST_SIZED_BELOW,
} = require("./ndz-common");

function main() {
  const inp = readHookInput();

  // Stay out of subagents and out of the handoff turn itself.
  if (inp.agent_id || inp.stop_hook_active) return 0;

  const { limit, source } = resolveLimit();

  pruneOldMarkers();

  const ctx = contextTokens(inp.transcript_path);
  if (ctx < limit) return 0;

  const marker = markerPath("handoff", inp.session_id);
  const fmt = (n) => n.toLocaleString("en-US");
  const cowork = isCowork();

  if (fs.existsSync(marker)) {
    emit({
      systemMessage:
        `NO DUMB ZONE: context is ${fmt(ctx)} tokens. The handoff is already written. ` +
        (cowork
          ? "Start a new task in Cowork and paste the title line from the handoff as your first message."
          : "Run /clear to start fresh."),
    });
    return 0;
  }

  fs.writeFileSync(marker, String(ctx));

  // A limit set inside a Cowork task lives in this container and dies with it.
  // The handoff's paste line is the only thing that reaches the next task, so
  // it carries the limit; ndz-pickup.js applies it there. Test-sized limits
  // stay behind, or the test would re-fire in every task that follows.
  const carry =
    cowork && source === "file" && limit >= TEST_SIZED_BELOW
      ? ` Limit carry-over: this task's limit was set with /no-dumb-zone:limit, so end the ` +
        `second line of the handoff with " Then /no-dumb-zone:limit ${limit}." and the next task keeps it.`
      : "";

  process.stderr.write(
    `NO DUMB ZONE: context is ${fmt(ctx)} tokens, over the ${fmt(limit)} limit. ` +
      "Do not start anything new. Run the /no-dumb-zone:handoff skill now, " +
      "follow it exactly, then stop. " +
      (cowork
        ? "Surface: Cowork. The project folder is a connected folder on the user's computer, " +
          "not in this workspace: write NOTES.md and CLAUDE.md there and commit there." +
          carry
        : "Surface: terminal.") +
      "\n"
  );
  return 2;
}

process.exitCode = main();
