"use strict";
/**
 * no-dumb-zone limit tool. Behind the /no-dumb-zone:limit skill; also fine by hand.
 *
 *   node ndz-limit.js [--data-dir DIR] [show | clear | <tokens>]
 *
 *   <tokens>   write DIR/limit. Accepts 100000, 100k, 0.5m, 250,000.
 *   show       print the limit the Stop hook will use and where it comes from. Default.
 *   clear      delete DIR/limit; the hook goes back to NDZ_LIMIT or the default.
 *
 * The Stop hook reads NDZ_LIMIT, then DIR/limit, then 250000. Hooks get DIR from
 * Claude Code as CLAUDE_PLUGIN_DATA; the Bash tool does not, so the skill passes
 * ${CLAUDE_PLUGIN_DATA} in as --data-dir. Without it this falls back to the same
 * place the hooks fall back to (ndz-common dataDir()).
 *
 * Exit 0 on success, 1 on a bad argument (usage on stderr).
 */

const fs = require("fs");
const {
  dataDir,
  isCowork,
  positiveInt,
  limitFilePath,
  limitFromFile,
  resolveLimit,
  DEFAULT_LIMIT,
  TEST_SIZED_BELOW,
  parseTokens,
  writeLimitFile,
} = require("./ndz-common");

const USAGE = "usage: node ndz-limit.js [--data-dir DIR] [show | clear | <tokens>]  (tokens: 100000, 100k, 0.5m)";

const fmt = (n) => n.toLocaleString("en-US");

function parseArgs(argv) {
  const out = { dir: "", cmd: "show", raw: "" };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data-dir") {
      out.dir = argv[++i] || "";
    } else if (a.startsWith("--data-dir=")) {
      out.dir = a.slice("--data-dir=".length);
    } else if (a.trim()) {
      rest.push(a.trim());
    }
  }
  if (rest.length > 1) return null;
  if (rest.length === 1) {
    out.raw = rest[0];
    const word = rest[0].toLowerCase();
    if (word === "show" || word === "status") out.cmd = "show";
    else if (word === "clear" || word === "reset" || word === "default") out.cmd = "clear";
    else out.cmd = "set";
  }
  // An unsubstituted or empty --data-dir means "wherever the hooks look by default".
  if (!out.dir || out.dir.includes("${")) out.dir = dataDir();
  return out;
}

/** Cowork only: what happens to a file limit when the task ends. */
function coworkFate(tokens) {
  return tokens >= TEST_SIZED_BELOW
    ? "the handoff's paste line carries this limit into the next task."
    : "a test-sized limit is not carried into the next task.";
}

function whereItLands(tokens) {
  return isCowork()
    ? `This is a Cowork task: the file dies with it, but ${coworkFate(tokens)}`
    : "Persists for every session on this machine.";
}

function describe(dir) {
  const { limit, source } = resolveLimit(dir);
  const file = limitFilePath(dir);
  const fileVal = limitFromFile(dir);
  const env = positiveInt(process.env.NDZ_LIMIT);
  const why = { env: "from NDZ_LIMIT", file: "from the limit file", default: "the default" }[source];
  const lines = [
    `no-dumb-zone limit: ${fmt(limit)} tokens (${why}).`,
    `  limit file: ${file} (${fileVal ? fmt(fileVal) : fs.existsSync(file) ? "present but not a number" : "absent"})`,
    `  NDZ_LIMIT: ${env ? fmt(env) + ", takes precedence over the file" : "unset"}`,
  ];
  if (isCowork() && source === "file") {
    lines.push(`  Cowork task: the file dies with it, but ${coworkFate(limit)}`);
  }
  return lines.join("\n");
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args) {
    process.stderr.write(USAGE + "\n");
    return 1;
  }
  const { dir, cmd } = args;
  const file = limitFilePath(dir);

  if (cmd === "show") {
    process.stdout.write(describe(dir) + "\n");
    return 0;
  }

  if (cmd === "clear") {
    const had = limitFromFile(dir) || fs.existsSync(file);
    try {
      fs.unlinkSync(file);
    } catch {
      /* already absent */
    }
    const { limit, source } = resolveLimit(dir);
    process.stdout.write(
      (had ? `Removed ${file}. ` : `No limit file at ${file}. `) +
        `The Stop hook now uses ${fmt(limit)} tokens (${source === "env" ? "NDZ_LIMIT" : "the default"}).\n`
    );
    return 0;
  }

  const tokens = parseTokens(args.raw);
  if (!tokens) {
    process.stderr.write(`not a token count: "${args.raw}"\n${USAGE}\n`);
    return 1;
  }
  const before = resolveLimit(dir);
  writeLimitFile(dir, tokens);
  const env = positiveInt(process.env.NDZ_LIMIT);

  const out = [
    `no-dumb-zone limit set to ${fmt(tokens)} tokens (was ${fmt(before.limit)}, ${before.source === "default" ? "the default" : "from " + (before.source === "env" ? "NDZ_LIMIT" : "the limit file")}).`,
    `  file: ${file}`,
    `  ${whereItLands(tokens)} Takes effect the next time Claude stops.`,
  ];
  if (env) {
    out.push(
      `  NDZ_LIMIT=${fmt(env)} is set in this environment and wins over the file; the file only applies where NDZ_LIMIT is unset.`
    );
  }
  if (tokens < 10000) {
    out.push(`  ${fmt(tokens)} is a test-sized limit: the handoff will fire at the very next stop.`);
  }
  if (tokens > DEFAULT_LIMIT) {
    out.push(`  Above the ${fmt(DEFAULT_LIMIT)} default. Make sure it is still below your auto-compact point or the hook never fires.`);
  }
  process.stdout.write(out.join("\n") + "\n");
  return 0;
}

process.exitCode = main(process.argv.slice(2));
