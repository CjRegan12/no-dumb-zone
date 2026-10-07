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
 *    DEFAULT_LIMIT
 *  Shared by ndz-check.js (reads) and ndz-limit.js (reads and writes). */
const DEFAULT_LIMIT = 250000;
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
  return { limit: DEFAULT_LIMIT, source: "default" };
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
  DEFAULT_LIMIT,
  LIMIT_FILE,
  positiveInt,
  limitFilePath,
  limitFromFile,
  resolveLimit,
};
