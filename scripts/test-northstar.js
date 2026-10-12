"use strict";
// Drives ndz-northstar.js through whole sessions with fake hook input. Run: node scripts/test-northstar.js
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { isCorrection, upsertLedger } = require("./ndz-northstar");

const SCRIPT = path.join(__dirname, "ndz-northstar.js");
let n = 0, fails = 0;
function ok(name, cond, extra) {
  n++;
  if (!cond) {
    fails++;
    console.log("  FAIL ", name, extra ? String(extra).slice(0, 400) : "");
  }
}

let T, proj, data, transcript, sid = 0, surface = "terminal";
function session(withFile = true) {
  T = fs.mkdtempSync(path.join(os.tmpdir(), "ns-"));
  proj = path.join(T, "proj");
  data = path.join(T, "data");
  fs.mkdirSync(proj);
  transcript = path.join(T, "t.jsonl");
  fs.writeFileSync(transcript, "");
  sid++;
  surface = "terminal";
  if (withFile)
    fs.writeFileSync(
      path.join(proj, "NORTHSTAR.md"),
      "# propfein: north star\n\n## Vision\nA +EV betting engine for one bettor.\n\n## Now\n- Closing-line capture on a schedule\n\n## Not yet\n- Public signups\n\n## Bar\n- Tests hit a real database\n\n## Rules\n- 2026-10-01: never mock Supabase in tests\n\n## Ledger\n- 2026-10-10 · cowork · built the P/L chart\n"
    );
}
function run(ev, extra) {
  const r = spawnSync("node", [SCRIPT], {
    input: JSON.stringify({ session_id: "sess" + sid + "-abcdef", hook_event_name: ev, transcript_path: transcript, cwd: proj, ...extra }),
    env: { ...process.env, CLAUDE_PLUGIN_DATA: data, CLAUDE_PROJECT_DIR: proj, NDZ_SURFACE: surface },
    encoding: "utf8",
  });
  let ctx = "";
  try {
    ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  } catch {}
  return { code: r.status, ctx, err: r.stderr, out: r.stdout };
}
const prompt = (text) => {
  fs.appendFileSync(transcript, JSON.stringify({ type: "user", message: { role: "user", content: text } }) + "\n");
  return run("UserPromptSubmit", { prompt: text });
};
const edit = (file, text = "x") =>
  fs.appendFileSync(
    transcript,
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "Edit", input: { file_path: file, old_string: "a", new_string: text } }] } }) + "\n"
  );
const devBash = (cmd) =>
  fs.appendFileSync(
    transcript,
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", name: "mcp__remote-devices__device_bash", input: { command: cmd } }] } }) + "\n"
  );
const say = (text) => fs.appendFileSync(transcript, JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } }) + "\n");
const stop = (extra) => run("Stop", extra || {});
const star = () => fs.readFileSync(path.join(proj, "NORTHSTAR.md"), "utf8");

// --- correction detector
const yes = ["no, use the real database", "I already told you not to mock it", "that's not what I asked for", "stop adding comments everywhere",
  "don't use tailwind here", "from now on always run the tests first", "remember to keep it dark mode", "why did you delete that file", "you keep changing the header"];
const no = ["add a settings page", "can you fix the login bug", "/no-dumb-zone:limit 200k", "nothing works on mobile, can you look", "I know you're busy but build the chart", ""];
for (const p of yes) ok(`detects: ${p}`, isCorrection(p));
for (const p of no) ok(`ignores: ${p}`, !isCorrection(p));

// --- terminal, file present: first prompt injects, ledger written, re-anchor
session();
let r = prompt("build the closing line job");
ok("first prompt injects steering", /NORTH STAR/.test(r.ctx) && /Closing-line capture/.test(r.ctx) && /never mock Supabase/.test(r.ctx) && /P\/L chart/.test(r.ctx), r.ctx);
ok("no Ledger header noise", !/## Ledger/.test(r.ctx));
r = prompt("ok next");
ok("second prompt silent", r.ctx === "", r.ctx);
edit(path.join(proj, "src", "jobs.ts"));
edit(path.join(proj, "src", "db.ts"));
r = stop();
ok("stop ok", r.code === 0, r.err);
ok("ledger line written", /terminal · build the closing line job · touched: src\/jobs.ts, src\/db.ts <!-- ndz:sess/.test(star()), star());
ok("older ledger kept", /built the P\/L chart/.test(star()));
edit(path.join(proj, "src", "cron.ts"));
stop();
const ledgerLines = star().split("\n").filter((l) => l.includes("<!-- ndz:sess"));
ok("same session line updated, not duplicated", ledgerLines.length === 1 && /cron.ts/.test(ledgerLines[0]), ledgerLines.join("\n"));
ok("new line on top", star().indexOf("terminal ·") < star().indexOf("cowork ·"));
ok("other sections intact", /## Rules\n- 2026-10-01: never mock Supabase/.test(star()) && /## Bar/.test(star()));
for (let i = 3; i <= 12; i++) r = prompt("step " + i);
ok("re-anchor at 12", /re-anchor/.test(r.ctx) && /never mock Supabase/.test(r.ctx) && !/Vision/.test(r.ctx), r.ctx);

// --- correction flow: saved / one-off / ignored
session();
prompt("build it");
r = prompt("no, I already told you never to mock the database");
ok("correction instruction", /may be correcting you/.test(r.ctx) && /## Rules/.test(r.ctx), r.ctx);
edit(path.join(proj, "NORTHSTAR.md"), "- 2026-10-11: never mock the database");
r = stop();
ok("saved correction passes", r.code === 0, r.err);

r = prompt("don't use that color here");
say("Changed it.\n\nNorth Star: one-off, not saved");
ok("one-off marker passes", stop().code === 0);

r = prompt("stop adding emoji to the UI");
say("Removed them.");
r = stop();
ok("ignored correction blocks once", r.code === 2 && /was not updated/.test(r.err), r.err);
ok("then lets go", stop({ stop_hook_active: false }).code === 0);

r = prompt("that's not what I asked for");
devBash("cd $HOME/mnt/propfein && printf -- '- 2026-10-11: x\\n' >> NORTHSTAR.md");
ok("cowork-style shell write counts as saved", stop().code === 0);

// --- no file in terminal: silent, no ledger, correction still offered
session(false);
r = prompt("hello");
ok("no file: first prompt silent", r.ctx === "", r.ctx);
edit(path.join(proj, "a.ts"));
ok("no file: stop ok, nothing created", stop().code === 0 && !fs.existsSync(path.join(proj, "NORTHSTAR.md")));
r = prompt("I told you to use pnpm");
ok("no file: correction says create it", /create it/.test(r.ctx), r.ctx);

// --- cowork: instructs to read, never writes
session();
surface = "cowork";
const before = star();
r = prompt("continue from NOTES.md");
ok("cowork first prompt points at device file", /Cowork task/.test(r.ctx) && /\$HOME\/mnt\/<folder>\/NORTHSTAR.md/.test(r.ctx) && /git log/.test(r.ctx), r.ctx);
edit(path.join(proj, "x.ts"));
ok("cowork stop ok and file untouched", stop().code === 0 && star() === before);

// --- subagents and bad input
session();
ok("subagent ignored", run("UserPromptSubmit", { prompt: "no, wrong", agent_id: "a1" }).out === "");
const g = spawnSync("node", [SCRIPT], { input: "garbage", encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_DATA: data } });
ok("garbage input exits 0", g.status === 0);

// --- upsertLedger on a file without a Ledger section
const added = upsertLedger("# x\n\n## Now\n- a\n", "- d · terminal · t <!-- ndz:1 -->", "<!-- ndz:1 -->");
ok("ledger section created", /## Ledger\n\n- d · terminal/.test(added), added);

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
