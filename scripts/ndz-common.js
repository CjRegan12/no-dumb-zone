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
 *  Drop anything older than a week so the data dir doesn't grow forever. */
function pruneOldMarkers() {
  const cutoff = Date.now() - MARKER_MAX_AGE_MS;
  let names = [];
  try {
    names = fs.readdirSync(dataDir());
  } catch {
    return;
  }
  for (const name of names) {
    const p = path.join(dataDir(), name);
    try {
      if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

/** Print one JSON object to stdout. Stdout must contain nothing else. */
function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

module.exports = { readHookInput, dataDir, markerPath, pruneOldMarkers, emit };
