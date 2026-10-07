"use strict";
/**
 * no-dumb-zone UserPromptSubmit hook.
 *
 * Runs on every prompt but acts once per session, on the first prompt of a
 * session that has no custom title yet:
 *
 *   NOTES.md in the project root -> session title = its first heading, and the
 *                                   whole file goes to Claude as context, so
 *                                   the new session starts briefed.
 *   no NOTES.md                  -> session title = "<folder>: <git branch>"
 *                                   when on a feature branch. Nothing else.
 *   Cowork, no NOTES.md          -> the project folder is on the user's
 *                                   computer and this hook cannot read it, so
 *                                   Claude is told where the notes live and
 *                                   reads them itself. Cowork names chats from
 *                                   the first message and ignores sessionTitle,
 *                                   so none is sent.
 *
 * Why UserPromptSubmit and not SessionStart: SessionStart also accepts
 * sessionTitle but ignores it when the session started from /clear, which is
 * exactly the case this plugin creates.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { readHookInput, markerPath, emit, isCowork } = require("./ndz-common");

const NOTES_FILE = "NOTES.md";
const MAX_CONTEXT_CHARS = 9000; // Claude Code caps additionalContext at 10k
const MAX_TITLE_CHARS = 80;

function projectRoot(inp) {
  return process.env.CLAUDE_PROJECT_DIR || inp.cwd || process.cwd();
}

function gitBranch(root) {
  try {
    return execFileSync("git", ["-C", root, "branch", "--show-current"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function titleFromNotes(text) {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line) return line.replace(/^#+\s*/, "").slice(0, MAX_TITLE_CHARS);
  }
  return "";
}

function main() {
  const inp = readHookInput();

  if (inp.agent_id) return 0;
  if (inp.session_title) return 0; // already named, by you or by an earlier run

  const done = markerPath("pickup", inp.session_id);
  if (fs.existsSync(done)) return 0;

  const root = projectRoot(inp);
  const notesPath = path.join(root, NOTES_FILE);
  const out = { hookEventName: "UserPromptSubmit" };

  if (fs.existsSync(notesPath)) {
    const text = fs.readFileSync(notesPath, "utf8");
    const title = titleFromNotes(text);
    if (title) out.sessionTitle = title;
    let body = text.slice(0, MAX_CONTEXT_CHARS);
    if (text.length > MAX_CONTEXT_CHARS) {
      body += `\n\n[NOTES.md truncated; read ${NOTES_FILE} for the rest]`;
    }
    out.additionalContext =
      `Handoff notes from the previous session (${NOTES_FILE} in the project root). ` +
      "Pick up from the next steps listed here.\n\n" +
      body;
  } else if (isCowork()) {
    out.additionalContext =
      "no-dumb-zone: this is a Cowork task, so the project folder is on the user's computer, " +
      "not in this workspace, and this hook cannot read it. When a project folder is connected, " +
      `a previous session may have left handoff notes at ${NOTES_FILE} in that folder's root ` +
      `($HOME/mnt/<folder>/${NOTES_FILE} in the device shell). Reading that file before anything ` +
      "else is how this session continues where the last one stopped: its Next steps section is " +
      "the plan, and CLAUDE.md beside it holds durable project facts. " +
      `No ${NOTES_FILE} means there is no handoff to pick up.`;
  } else {
    const branch = gitBranch(root);
    if (branch && branch !== "main" && branch !== "master") {
      out.sessionTitle = `${path.basename(root)}: ${branch}`.slice(0, MAX_TITLE_CHARS);
    }
  }

  fs.writeFileSync(done, "");

  if (Object.keys(out).length > 1) emit({ hookSpecificOutput: out });
  return 0;
}

process.exitCode = main();
