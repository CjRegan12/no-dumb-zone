"use strict";
// Shared helpers for the no-dumb-zone hooks. Node stdlib only.

const fs = require("fs");
const os = require("os");
const path = require("path");

const MARKER_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

/** Parse the hook JSON Claude Code sends on stdin. Returns {} on any failure. */
function readHookInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Where per-session markers live. CLAUDE_PLUGIN_DATA survives plugin updates;
 *  the fallback is for running the scripts by hand. */
function dataDir() {
  const d =
    process.env.CLAUDE_PLUGIN_DATA ||
    path.join(os.homedir(), ".cache", "no-dumb-zone");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function markerPath(kind, sessionId) {
  return path.join(dataDir(), `${kind}-${sessionId || "unknown"}`);
}

/** Markers are keyed by session id and never reused once a session is gone.
 *  Drop any older than a week so the data dir doesn't grow forever. Only
 *  marker files are touched; the optional `limit` file is the user's. */
function pruneOldMarkers() {
  const cutoff = Date.now() - MARKER_MAX_AGE_MS;
  let names = [];
  try {
    names = fs.readdirSync(dataDir());
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^(handoff|pickup)-/.test(name)) continue;
    const p = path.join(dataDir(), name);
    try {
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

/** The token limit the Stop hook enforces. First one that parses wins:
 *    NDZ_LIMIT env           terminal only; Cowork tasks cannot set env vars
 *    <dataDir>/limit         one number in a file; /no-dumb-zone:limit writes it
 *    defaultLimit()          by surface, see below
 *  Shared by ndz-check.js (reads) and ndz-limit.js (reads and writes). */

/** Default limits by surface. A Cowork task starts at roughly 130k tokens of
 *  context before Claude's first turn (Cowork's system prompt plus every
 *  connector's tool schema); the terminal starts far lower. The higher Cowork
 *  default gives both surfaces about the same working room. Both sit above
 *  where the published long-context data bends (~256k): the author chose
 *  session length over caution. Lower them with /no-dumb-zone:limit or
 *  NDZ_LIMIT; the plugin still catches the real failure, which is sitting at
 *  the ~967k auto-compact point for hours. */
const DEFAULT_LIMIT_TERMINAL = 500000;
const DEFAULT_LIMIT_COWORK = 600000;
function defaultLimit() {
  return isCowork() ? DEFAULT_LIMIT_COWORK : DEFAULT_LIMIT_TERMINAL;
}
const LIMIT_FILE = "limit";

function positiveInt(s) {
  const n = parseInt(String(s || "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function limitFilePath(dir) {
  return path.join(dir || dataDir(), LIMIT_FILE);
}

function limitFromFile(dir) {
  try {
    return positiveInt(fs.readFileSync(limitFilePath(dir), "utf8"));
  } catch {
    return 0;
  }
}

/** -> { limit, source } with source one of "env", "file", "default". */
function resolveLimit(dir) {
  const env = positiveInt(process.env.NDZ_LIMIT);
  if (env) return { limit: env, source: "env" };
  const file = limitFromFile(dir);
  if (file) return { limit: file, source: "file" };
  return { limit: defaultLimit(), source: "default" };
}

/** Limits below this are test-sized: they fire the handoff at the very next
 *  stop. The Cowork carry-over below never forwards one, or a test would
 *  re-fire in every task that follows. */
const TEST_SIZED_BELOW = 10000;

/** "100000" | "100k" | "0.5m" | "250,000" -> integer tokens, or 0 if not a limit. */
function parseTokens(s) {
  const m = /^(\d+(?:\.\d+)?)\s*([kKmM])?$/.exec(String(s || "").replace(/[,_]/g, "").trim());
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6 }[(m[2] || "").toLowerCase()] || 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Cowork carry-over. The limit file dies with the task's container, so the
 *  handoff's paste line ends with "Then /no-dumb-zone:limit <n>." and the
 *  pickup hook applies it from the first prompt of the next task. This is the
 *  reader side: the token count after /no-dumb-zone:limit in a prompt, or 0.
 *  Trailing punctuation from the sentence is ignored; "show" and "clear" are not limits. */
function limitFromPrompt(text) {
  const m = /\/no-dumb-zone:limit\s+(\S+)/.exec(String(text || ""));
  return m ? parseTokens(m[1].replace(/[.,;:!?)\]]+$/, "")) : 0;
}

/** The transcript side of the same reader. The pickup hook's first prompt is not
 *  always the user's first message: when a Cowork task's first turn restarts the
 *  session (seen when linking the computer loaded the device tools), the restarted
 *  session's first prompt is a harness line ("Continue with the task described in
 *  the conversation above.") and the user's message survives only in the
 *  transcript, which the restarted session inherits. This returns the limit in the
 *  first real user prompt there: the first `type: "user"` line with text left once
 *  tool results and <system-reminder> blocks are dropped. 0 when there is none. */
function limitFromTranscript(transcriptPath) {
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return 0;
  }
  for (const line of raw.split("\n")) {
    if (!line.includes('"user"')) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type !== "user" || e.isSidechain) continue;
    const content = e.message && e.message.content;
    const text = (typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.filter((b) => b && b.type === "text").map((b) => b.text || "").join("\n")
        : "")
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
      .trim();
    if (!text) continue;
    return limitFromPrompt(text);
  }
  return 0;
}

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

/** The transcript of the session a skill is running in, for scripts that are
 *  not hooks and so get no transcript_path. By session id when the skill could
 *  pass one (<config dir>/projects/<cwd slug>/<id>.jsonl), else the transcript
 *  written to most recently, which is the live session's. "" when none. */
function findTranscript(sessionId) {
  const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");
  let dirs = [];
  try {
    dirs = fs.readdirSync(root);
  } catch {
    return "";
  }
  let newest = "";
  let newestAt = 0;
  for (const d of dirs) {
    let names = [];
    try {
      names = fs.readdirSync(path.join(root, d));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".jsonl")) continue;
      const p = path.join(root, d, name);
      if (sessionId && name === sessionId + ".jsonl") return p;
      try {
        const at = fs.statSync(p).mtimeMs;
        if (at > newestAt) {
          newestAt = at;
          newest = p;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return newest;
}

function writeLimitFile(dir, tokens) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(limitFilePath(dir), String(tokens) + "\n");
}

/** Print one JSON object to stdout. Stdout must contain nothing else. */
function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

/** Which surface the session is on.
 *
 *  Cowork tasks run Claude Code in a throwaway cloud container. The user's
 *  project folder is on their computer, reached through the device tools,
 *  and is NOT on this filesystem, so hooks cannot read or write it. The
 *  terminal, VS Code and Claude Code on the web all have the project on disk.
 *
 *  Detection: Claude Code sets CLAUDE_CODE_ENTRYPOINT=remote_cowork in Cowork
 *  tasks. NDZ_SURFACE=cowork|terminal overrides it, for tests and odd setups. */
function isCowork() {
  const forced = (process.env.NDZ_SURFACE || "").toLowerCase();
  if (forced) return forced === "cowork";
  return process.env.CLAUDE_CODE_ENTRYPOINT === "remote_cowork";
}

module.exports = {
  readHookInput,
  dataDir,
  markerPath,
  pruneOldMarkers,
  emit,
  isCowork,
  DEFAULT_LIMIT_TERMINAL,
  DEFAULT_LIMIT_COWORK,
  defaultLimit,
  LIMIT_FILE,
  positiveInt,
  limitFilePath,
  limitFromFile,
  resolveLimit,
  TEST_SIZED_BELOW,
  parseTokens,
  limitFromPrompt,
  limitFromTranscript,
  contextTokens,
  findTranscript,
  writeLimitFile,
};
