"use strict";
/**
 * no-dumb-zone North Star. One script for two hook events.
 *
 * NORTHSTAR.md in the project root holds what the user wants: the vision, the
 * phase (Now / Not yet), the quality bar, standing Rules taken from their
 * corrections, and a Ledger of what each session did, terminal or Cowork.
 *
 *   UserPromptSubmit
 *     first prompt of a session  terminal: inject the file. Cowork: the file is
 *                                on the user's computer, so tell Claude to read it.
 *     every REANCHOR_EVERY       re-inject Now, Not yet, Bar and Rules, because a
 *                                long session forgets what it read at the start.
 *     a correction in the prompt tell Claude to save it as a Rule, in the user's
 *                                words, before going on.
 *   Stop
 *     correction not saved       block once: save it, or say it was a one-off.
 *     terminal, files touched    upsert this session's Ledger line. No model:
 *                                date, surface, the session's first ask, files.
 *
 * Node stdlib only. Never blocks a session over its own failure.
 */

const fs = require("fs");
const path = require("path");
const { readHookInput, dataDir, emit, isCowork } = require("./ndz-common");

const FILE = "NORTHSTAR.md";
const REANCHOR_EVERY = 12; // prompts
const MAX_INJECT = 8500; // additionalContext is capped near 10k
const LEDGER_KEEP = 30;
const ONE_OFF_MARKER = "North Star: one-off, not saved";

// Phrases that mean "you got it wrong" or "keep doing this". Claude decides
// whether it is a standing rule or a one-off; the Stop check accepts either.
const CORRECTION_RE = [
  /\bI (?:already |just )?(?:told|said to|asked) you\b/i,
  /\b(?:like|as) I (?:said|told you|mentioned)\b/i,
  /\bhow many times\b/i,
  /\bnot what I (?:asked|wanted|meant|said)\b/i,
  /\bthat'?s (?:not|wrong|not right|not it)\b/i,
  /\bstop (?:doing|adding|using|making|writing|changing|touching)\b/i,
  /\byou keep\b/i,
  /\bwhy (?:did|would) you\b/i,
  /\b(?:don'?t|do not|never) (?:ever )?(?:do|use|add|make|touch|change|create|write|put|delete|remove|mock|skip)\b/i,
  /\b(?:always|from now on|going forward|in the future)\b[^.?!]{0,60}\b(?:use|do|make|run|write|test|check|keep|put)\b/i,
  /\bremember (?:that|to)\b/i,
  /^\s*(?:no|nope|wrong)\b[\s,.!]/i,
];

// ---- small helpers ----------------------------------------------------------

function projectRoot(inp) {
  return process.env.CLAUDE_PROJECT_DIR || inp.cwd || process.cwd();
}

function statePath(id) {
  return path.join(dataDir(), `northstar-${String(id || "unknown").replace(/[^\w-]/g, "_")}.json`);
}

function load(id) {
  try {
    return JSON.parse(fs.readFileSync(statePath(id), "utf8"));
  } catch {
    return { prompts: 0, firstAsk: "", flag: null };
  }
}

function save(id, s) {
  try {
    fs.writeFileSync(statePath(id), JSON.stringify(s));
  } catch {
    /* best effort */
  }
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function oneLine(s, max) {
  const t = String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** -> { title, sections: Map(lowercased heading -> body) } for "## " headings. */
function parse(text) {
  const sections = new Map();
  let title = "";
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const h1 = /^#\s+(.*)/.exec(line);
    const h2 = /^##\s+(.*)/.exec(line);
    if (h1 && !title) title = h1[1].trim();
    else if (h2) {
      cur = h2[1].trim().toLowerCase();
      sections.set(cur, []);
    } else if (cur) sections.get(cur).push(line);
  }
  for (const [k, v] of sections) sections.set(k, v.join("\n").trim());
  return { title, sections };
}

function pick(sections, ...names) {
  for (const n of names) for (const [k, v] of sections) if (k.startsWith(n)) return v;
  return "";
}

/** The parts that steer the work, without the Ledger. */
function steeringText(text) {
  const { sections } = parse(text);
  const parts = [];
  const add = (label, body) => body && parts.push(`${label}:\n${body}`);
  add("Now", pick(sections, "now"));
  add("Not yet", pick(sections, "not yet"));
  add("Bar", pick(sections, "bar", "quality"));
  add("Rules", pick(sections, "rules"));
  return parts.join("\n\n");
}

function cap(text, max) {
  return text.length > max ? text.slice(0, max) + `\n\n[${FILE} truncated; read the file for the rest]` : text;
}

function isCorrection(prompt) {
  const p = String(prompt || "");
  if (!p.trim() || p.trim().startsWith("/")) return "";
  const head = p.slice(0, 600);
  if (!CORRECTION_RE.some((re) => re.test(head))) return "";
  return oneLine(head, 160);
}

// ---- transcript reading ------------------------------------------------------

function transcriptRows(p) {
  const raw = readFileSafe(p);
  if (!raw) return [];
  const rows = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* skip */
    }
  }
  return rows;
}

function isRealUserPrompt(row) {
  if (row.type !== "user" || row.isSidechain || row.isMeta) return false;
  const c = row.message && row.message.content;
  if (typeof c === "string") return c.trim() !== "";
  return Array.isArray(c) && c.some((b) => b && b.type === "text" && String(b.text || "").trim());
}

function toolUses(row) {
  const c = row.type === "assistant" && row.message && row.message.content;
  return Array.isArray(c) ? c.filter((b) => b && b.type === "tool_use") : [];
}

function assistantText(row) {
  const c = row.type === "assistant" && row.message && row.message.content;
  if (typeof c === "string") return c;
  return Array.isArray(c) ? c.filter((b) => b && b.type === "text").map((b) => b.text || "").join("\n") : "";
}

/** Rows after the last real user prompt: this turn. */
function thisTurn(rows) {
  let i = rows.length - 1;
  while (i >= 0 && !isRealUserPrompt(rows[i])) i--;
  return rows.slice(i + 1);
}

function filesTouched(rows, root) {
  const out = [];
  for (const row of rows) {
    if (row.isSidechain) continue;
    for (const t of toolUses(row)) {
      if (!/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(t.name || "")) continue;
      const f = (t.input && (t.input.file_path || t.input.notebook_path)) || "";
      if (!f || path.basename(f) === FILE) continue;
      let rel = path.relative(root, f);
      if (rel.startsWith("..") || path.isAbsolute(rel)) rel = path.basename(f);
      rel = rel.split(path.sep).join("/");
      if (!out.includes(rel)) out.push(rel);
    }
  }
  return out;
}

// ---- events -----------------------------------------------------------------

const ABOUT =
  `NORTH STAR: this project keeps what the user wants in ${FILE}. ` +
  "Now and Not yet set the scope: do not build what Not yet lists, and say so if a request crosses it. " +
  "Bar is what good means here; passing tests alone is not done. " +
  "Rules are the user's own standing corrections: follow every one, never soften them. " +
  "Ledger shows what earlier sessions did, in the terminal and in Cowork, newest first.";

function onPrompt(inp, s) {
  const cowork = isCowork();
  const root = projectRoot(inp);
  const text = cowork ? null : readFileSafe(path.join(root, FILE));
  const parts = [];

  s.prompts = (s.prompts || 0) + 1;
  if (s.prompts === 1) s.firstAsk = oneLine(inp.prompt, 70);

  if (s.prompts === 1) {
    if (cowork) {
      parts.push(
        `${ABOUT}\nThis is a Cowork task: the project folder is on the user's computer and this hook cannot read it. ` +
          `If a project folder is connected, read ${FILE} at its root ($HOME/mnt/<folder>/${FILE} in the device shell) before your first reply, ` +
          "then run `git log --oneline` there since the newest Ledger date, so you know what the terminal did since. " +
          `No ${FILE} there means there is nothing to load. ` +
          `When you finish a piece of work in this task, add or update one line at the top of ## Ledger: ` +
          "`- YYYY-MM-DD · cowork · <what got done> · touched: <files>`."
      );
    } else if (text) {
      const { sections } = parse(text);
      const ledger = pick(sections, "ledger").split("\n").filter((l) => l.trim().startsWith("-")).slice(0, 8).join("\n");
      const body = [steeringText(text), pick(sections, "vision") && `Vision:\n${pick(sections, "vision")}`, ledger && `Recent ledger:\n${ledger}`]
        .filter(Boolean)
        .join("\n\n");
      parts.push(`${ABOUT}\n\n${cap(body, MAX_INJECT - ABOUT.length - 400)}`);
    }
  } else if (s.prompts % REANCHOR_EVERY === 0) {
    if (cowork) {
      parts.push(`NORTH STAR re-anchor: re-read Now, Not yet, Bar and Rules in ${FILE} in the connected project folder before going on.`);
    } else if (text) {
      parts.push(`NORTH STAR re-anchor (long session, reread this):\n\n${cap(steeringText(text), MAX_INJECT - 600)}`);
    }
  }

  const quote = isCorrection(inp.prompt);
  if (quote) {
    s.flag = { at: s.prompts, quote };
    const where = cowork ? `${FILE} at the root of the connected project folder (device shell)` : `${FILE} in the project root`;
    parts.push(
      `NORTH STAR: the user may be correcting you ("${quote}"). ` +
        `If it states something they want from now on, add it first, as one line under ## Rules in ${where}: ` +
        "`- YYYY-MM-DD: <the rule, in their words>`. Keep their wording, do not soften it, do not duplicate a rule already there. " +
        `No ${FILE} yet: create it with a # title line and a ## Rules section. ` +
        `If it only applies to this one step, do not save it, and end your reply with the line "${ONE_OFF_MARKER}". Then do what they asked.`
    );
  }

  if (parts.length) emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: parts.join("\n\n") } });
  return 0;
}

function upsertLedger(text, line, tag) {
  const lines = text.split(/\r?\n/);
  let start = lines.findIndex((l) => /^##\s+ledger\b/i.test(l));
  if (start === -1) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push("", "## Ledger", "");
    start = lines.length - 2;
  }
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end).filter((l) => l.trim() && !l.includes(tag));
  const kept = [line, ...body.filter((l) => l.trim().startsWith("-"))].slice(0, LEDGER_KEEP);
  const other = body.filter((l) => !l.trim().startsWith("-"));
  const rebuilt = [...lines.slice(0, start + 1), "", ...other, ...kept, ""];
  const tail = lines.slice(end);
  return [...rebuilt, ...tail].join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n*$/, "\n");
}

function onStop(inp, s) {
  if (inp.agent_id || inp.stop_hook_active) return 0;
  const cowork = isCowork();
  const root = projectRoot(inp);
  const rows = transcriptRows(inp.transcript_path);
  const turn = thisTurn(rows);

  // 1. A correction this turn has to land in the file, or be called a one-off.
  if (s.flag && !s.flag.done) {
    const saved = turn.some((r) => toolUses(r).some((t) => JSON.stringify(t.input || {}).includes(FILE)));
    const lastText = (inp.last_assistant_message || turn.map(assistantText).filter(Boolean).pop() || "").toString();
    s.flag.done = true;
    if (!saved && !lastText.includes(ONE_OFF_MARKER)) {
      process.stderr.write(
        `NORTH STAR: you were corrected this turn ("${s.flag.quote}") and ${FILE} was not updated. ` +
          `If it is something the user wants from now on, add it as one line under ## Rules now, in their words, then finish. ` +
          `If it only applied to this step, end your reply with the line "${ONE_OFF_MARKER}".\n`
      );
      return 2;
    }
  }

  // 2. Terminal: this session's Ledger line, kept current after every turn that edited files.
  if (!cowork) {
    const file = path.join(root, FILE);
    const text = readFileSafe(file);
    if (text) {
      const touched = filesTouched(rows, root);
      if (touched.length) {
        const tag = `<!-- ndz:${String(inp.session_id || "x").slice(0, 8)} -->`;
        const shown = touched.slice(0, 4).join(", ") + (touched.length > 4 ? ` (+${touched.length - 4})` : "");
        const line = `- ${today()} · terminal · ${s.firstAsk || "session"} · touched: ${shown} ${tag}`;
        try {
          const next = upsertLedger(text, line, tag);
          if (next !== text) fs.writeFileSync(file, next);
        } catch {
          /* never break a stop over the ledger */
        }
      }
    }
  }
  return 0;
}

function main() {
  const inp = readHookInput();
  if (inp.agent_id) return 0;
  const s = load(inp.session_id);
  let code = 0;
  if (inp.hook_event_name === "UserPromptSubmit") code = onPrompt(inp, s);
  else if (inp.hook_event_name === "Stop") code = onStop(inp, s);
  save(inp.session_id, s);
  return code;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch {
    process.exitCode = 0;
  }
}

module.exports = { isCorrection, upsertLedger, steeringText, parse };
