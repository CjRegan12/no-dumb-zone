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
  markerPath,
  pruneOldMarkers,
  emit,
  isCowork,
  resolveLimit,
  TEST_SIZED_BELOW,
} = require("./ndz-common");

const TAIL_BYTES = 512 * 1024; // read this much from the end of the transcript first

/** Context size = total input tokens of the most recent assistant message.
 *  Each assistant line carries message.usage with input_tokens,
 *  cache_read_input_tokens and cache_creation_input_tokens. Their sum is what
 *  the model saw on that request, i.e. the live context. Transcripts get big,
 *  so read the tail first and only fall back to a full scan if needed. */
function contextTokens(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;
  let size;
  try {
    size = fs.statSync(transcriptPath).size;
  } catch {
    return 0;
  }

  let tail;
  if (size > TAIL_BYTES) {
    const fd = fs.openSync(transcriptPath, "r");
    try {
      const buf = Buffer.alloc(TAIL_BYTES);
      fs.readSync(fd, buf, 0, TAIL_BYTES, size - TAIL_BYTES);
      tail = buf.toString("utf8");
      tail = tail.slice(tail.indexOf("\n") + 1); // drop the partial line we landed in
    } finally {
      fs.closeSync(fd);
    }
  } else {
    tail = fs.readFileSync(transcriptPath, "utf8");
  }

  const fromTail = lastUsage(tail.split("\n"));
  if (fromTail || size <= TAIL_BYTES) return fromTail;
  return lastUsage(fs.readFileSync(transcriptPath, "utf8").split("\n"));
}

function lastUsage(lines) {
  let last = 0;
  for (let line of lines) {
    line = line.trim();
    if (!line || !line.includes('"usage"')) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (rec.type !== "assistant") continue;
    const u = (rec.message && rec.message.usage) || {};
    const total =
      (u.input_tokens || 0) +
      (u.cache_read_input_tokens || 0) +
      (u.cache_creation_input_tokens || 0);
    if (total) last = total;
  }
  return last;
}

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
