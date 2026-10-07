"use strict";
/**
 * no-dumb-zone PermissionRequest hook.
 *
 * Invoking a plugin skill through the Skill tool asks for permission. In a
 * terminal you would answer yes; in headless, Cowork, or dontAsk sessions there
 * is nobody to answer and the handoff is silently denied. This hook approves
 * exactly one call: the Skill tool invoking this plugin's own handoff skill.
 * Everything else gets no decision and goes through the normal flow.
 *
 * To opt out, delete the PermissionRequest entry from hooks/hooks.json and add
 *   "permissions": { "allow": ["Skill(no-dumb-zone:handoff)"] }
 * to your settings instead.
 */

const { readHookInput, emit } = require("./ndz-common");

const OUR_SKILL = "no-dumb-zone:handoff";

function main() {
  const inp = readHookInput();
  if (inp.tool_name !== "Skill") return 0;
  const skill = String((inp.tool_input && inp.tool_input.skill) || "").trim();
  if (skill !== OUR_SKILL) return 0;
  emit({
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "allow" },
    },
  });
  return 0;
}

process.exitCode = main();
