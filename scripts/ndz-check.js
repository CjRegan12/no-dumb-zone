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
 * Env:
 *   NDZ_LIMIT  context tokens that trigger the handoff. Default 250000.
 *              Set it below your auto-compact point or this never runs.
 */

const fs = require("fs");
const { readHookInput, markerPath, pruneOldMarkers, emit } = require("./ndz-common");

const DEFAULT_LIMIT = 250000;
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

  let limit = parseInt(process.env.NDZ_LIMIT || "", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT;

  pruneOldMarkers();

  const ctx = contextTokens(inp.transcript_path);
  if (ctx < limit) return 0;

  const marker = markerPath("handoff", inp.session_id);
  const fmt = (n) => n.toLocaleString("en-US");

  if (fs.existsSync(marker)) {
    emit({
      systemMessage:
        `NO DUMB ZONE: context is ${fmt(ctx)} tokens. ` +
        "The handoff is already written. Start a fresh session: " +
        "a new task in Cowork, or /clear in the terminal.",
    });
    return 0;
  }

  fs.writeFileSync(marker, String(ctx));
  process.stderr.write(
    `NO DUMB ZONE: context is ${fmt(ctx)} tokens, over the ${fmt(limit)} limit. ` +
      "Do not start anything new. Run the /no-dumb-zone:handoff skill now, " +
      "follow it exactly, then stop.\n"
  );
  return 2;
}

process.exitCode = main();
