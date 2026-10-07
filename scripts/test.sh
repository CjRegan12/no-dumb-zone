#!/bin/bash
# Exercises the no-dumb-zone hook scripts with fake hook input and a fake transcript.
set -u
PLUGIN=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
export CLAUDE_PLUGIN_DATA="$T/data"
export CLAUDE_PROJECT_DIR="$T/proj"
export NDZ_SURFACE=terminal      # pin the surface; Cowork cases override per call
unset CLAUDE_CODE_ENTRYPOINT
mkdir -p "$CLAUDE_PROJECT_DIR"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS  $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL  $1"; echo "        $2"; }

# --- fake transcript: three assistant turns, context grows to 180k ---
BIG="$T/big.jsonl"
{
  echo '{"type":"user","message":{"role":"user","content":"hi"}}'
  echo '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":1200,"cache_read_input_tokens":20000,"cache_creation_input_tokens":500,"output_tokens":300}}}'
  echo '{"type":"user","message":{"role":"user","content":"more"}}'
  echo '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":900,"cache_read_input_tokens":150000,"cache_creation_input_tokens":2000,"output_tokens":800}}}'
  echo '{"type":"system","subtype":"noise"}'
  echo '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":1000,"cache_read_input_tokens":175000,"cache_creation_input_tokens":4000,"output_tokens":100}}}'
} > "$BIG"   # last = 180,000
SMALL="$T/small.jsonl"
echo '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":1000,"cache_read_input_tokens":5000,"cache_creation_input_tokens":0}}}' > "$SMALL"

run_check() { # $1=json stdin, $2=limit  -> sets OUT ERR CODE
  OUT=$(echo "$1" | NDZ_LIMIT="$2" node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
}
run_pickup() { # $1=json stdin -> OUT ERR CODE
  OUT=$(echo "$1" | node "$PLUGIN/scripts/ndz-pickup.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
}

echo "== ndz-check.js =="

run_check '{"session_id":"s1","transcript_path":"'"$SMALL"'","stop_hook_active":false}' 250000
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "1 under limit: exit 0, silent" || fail "1 under limit" "code=$CODE out=$OUT err=$ERR"

run_check '{"session_id":"s2","transcript_path":"'"$BIG"'","stop_hook_active":false}' 250000
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "1b 180k under 250k: exit 0" || fail "1b 180k under 250k" "code=$CODE out=$OUT"

run_check '{"session_id":"s3","transcript_path":"'"$BIG"'","stop_hook_active":false}' 100000
[ $CODE -eq 2 ] && [[ "$ERR" == *"180,000"* ]] && [[ "$ERR" == *"/no-dumb-zone:handoff"* ]] && [[ "$ERR" == *"Surface: terminal"* ]] && [ -f "$CLAUDE_PLUGIN_DATA/handoff-s3" ] \
  && ok "2 over limit first stop: exit 2, names skill + surface, marker written" || fail "2 over limit first stop" "code=$CODE err=$ERR"

run_check '{"session_id":"s3","transcript_path":"'"$BIG"'","stop_hook_active":false}' 100000
[ $CODE -eq 0 ] && echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert "/clear" in d["systemMessage"] and "Cowork" not in d["systemMessage"]' 2>/dev/null \
  && ok "3 over limit after handoff: exit 0, /clear nag, valid JSON" || fail "3 after handoff" "code=$CODE out=$OUT"

run_check '{"session_id":"s4","transcript_path":"'"$BIG"'","stop_hook_active":true}' 100000
[ $CODE -eq 0 ] && [ -z "$OUT" ] && [ ! -f "$CLAUDE_PLUGIN_DATA/handoff-s4" ] && ok "4 stop_hook_active true: exit 0, no marker" || fail "4 stop_hook_active" "code=$CODE"

run_check '{"session_id":"s5","agent_id":"a1","agent_type":"Explore","transcript_path":"'"$BIG"'","stop_hook_active":false}' 100000
[ $CODE -eq 0 ] && [ -z "$OUT" ] && [ ! -f "$CLAUDE_PLUGIN_DATA/handoff-s5" ] && ok "5 subagent: exit 0, no marker" || fail "5 subagent" "code=$CODE"

run_check '{"session_id":"s6","transcript_path":"/nope/missing.jsonl","stop_hook_active":false}' 100000
[ $CODE -eq 0 ] && ok "6 missing transcript: exit 0" || fail "6 missing transcript" "code=$CODE err=$ERR"

run_check 'not json at all' 100000
[ $CODE -eq 0 ] && ok "7 garbage stdin: exit 0" || fail "7 garbage stdin" "code=$CODE err=$ERR"

# tail-read path: pad a transcript past 512KB then append the real lines
HUGE="$T/huge.jsonl"
python3 - "$HUGE" <<'EOF'
import sys, json
p = sys.argv[1]
with open(p, "w") as f:
    for i in range(3000):
        f.write(json.dumps({"type":"user","message":{"content":"x"*300,"i":i}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"usage":{"input_tokens":500,"cache_read_input_tokens":299000,"cache_creation_input_tokens":500}}})+"\n")
EOF
run_check '{"session_id":"s8","transcript_path":"'"$HUGE"'","stop_hook_active":false}' 250000
[ $CODE -eq 2 ] && [[ "$ERR" == *"300,000"* ]] && ok "8 >512KB transcript, tail read finds 300k: exit 2" || fail "8 tail read" "code=$CODE err=$ERR size=$(stat -c%s "$HUGE")"

# stale marker pruning
touch -d '10 days ago' "$CLAUDE_PLUGIN_DATA/handoff-old"
run_check '{"session_id":"s9","transcript_path":"'"$SMALL"'","stop_hook_active":false}' 250000
[ ! -f "$CLAUDE_PLUGIN_DATA/handoff-old" ] && [ -f "$CLAUDE_PLUGIN_DATA/handoff-s3" ] && ok "9 prune: 10-day-old marker gone, fresh one kept" || fail "9 prune" "$(ls $CLAUDE_PLUGIN_DATA)"

echo "== ndz-pickup.js =="

cat > "$CLAUDE_PROJECT_DIR/NOTES.md" <<'EOF'
# inkbook: booking flow (3)

## Done this session
- wired BookingSheet to Supabase

## Next steps
1. add the deposit step in BookingSheet.swift
EOF

run_pickup '{"session_id":"p1","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"what next?"}'
python3 - "$OUT" <<'EOF' && ok "10 NOTES.md present: title + additionalContext, valid JSON" || fail "10 pickup with notes" "code=$CODE out=$OUT err=$ERR"
import json, sys
d = json.loads(sys.argv[1])["hookSpecificOutput"]
assert d["hookEventName"] == "UserPromptSubmit"
assert d["sessionTitle"] == "inkbook: booking flow (3)", d["sessionTitle"]
assert "deposit step" in d["additionalContext"]
EOF

run_pickup '{"session_id":"p1","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"again"}'
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "11 second prompt same session: silent" || fail "11 second prompt" "out=$OUT"

run_pickup '{"session_id":"p2","session_title":"my-name","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}'
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "12 existing title wins: silent" || fail "12 existing title" "out=$OUT"

run_pickup '{"session_id":"p3","agent_id":"a9","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}'
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "13 subagent prompt: silent" || fail "13 subagent" "out=$OUT"

# no NOTES.md, feature branch -> branch fallback
rm "$CLAUDE_PROJECT_DIR/NOTES.md"
git -C "$CLAUDE_PROJECT_DIR" init -q && git -C "$CLAUDE_PROJECT_DIR" checkout -q -b feat/deposits 2>/dev/null
run_pickup '{"session_id":"p4","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}'
python3 - "$OUT" <<'EOF' && ok "14 no notes, feature branch: title from branch" || fail "14 branch fallback" "code=$CODE out=$OUT err=$ERR"
import json, sys
d = json.loads(sys.argv[1])["hookSpecificOutput"]
assert d["sessionTitle"].endswith(": feat/deposits"), d
assert "additionalContext" not in d
EOF

git -C "$CLAUDE_PROJECT_DIR" checkout -q -b main 2>/dev/null
run_pickup '{"session_id":"p5","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}'
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "15 no notes, on main: silent" || fail "15 on main" "out=$OUT"

# oversized NOTES.md gets truncated under the 10k cap
python3 -c "print('# big: notes (1)\n' + ('- line\n'*3000))" > "$CLAUDE_PROJECT_DIR/NOTES.md"
run_pickup '{"session_id":"p6","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}'
python3 - "$OUT" <<'EOF' && ok "16 oversized notes: context under 10k, truncation note present" || fail "16 truncation" "out=${OUT:0:200}"
import json, sys
d = json.loads(sys.argv[1])["hookSpecificOutput"]
assert len(d["additionalContext"]) < 10000, len(d["additionalContext"])
assert "truncated" in d["additionalContext"]
EOF

echo "== Cowork surface =="

# detection: the real env var, no override
OUT=$(echo '{"session_id":"c0","transcript_path":"'"$BIG"'","stop_hook_active":false}' | NDZ_SURFACE= CLAUDE_CODE_ENTRYPOINT=remote_cowork NDZ_LIMIT=100000 node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
[ $CODE -eq 2 ] && [[ "$ERR" == *"Surface: Cowork"* ]] && [[ "$ERR" == *"user's computer"* ]] \
  && ok "17 CLAUDE_CODE_ENTRYPOINT=remote_cowork detected: exit 2 says Cowork, points at the connected folder" || fail "17 cowork detect" "code=$CODE err=$ERR"

# after handoff in Cowork: nag says new task, never /clear
OUT=$(echo '{"session_id":"c0","transcript_path":"'"$BIG"'","stop_hook_active":false}' | NDZ_SURFACE=cowork NDZ_LIMIT=100000 node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && echo "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); m=d["systemMessage"]; assert "new task" in m and "/clear" not in m, m' 2>/dev/null \
  && ok "18 Cowork after handoff: nag says new task, no /clear" || fail "18 cowork nag" "code=$CODE out=$OUT"

# pickup in Cowork with no NOTES.md on this filesystem: context points at the device folder, no title
rm -f "$CLAUDE_PROJECT_DIR/NOTES.md"
OUT=$(echo '{"session_id":"c1","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"hi"}' | NDZ_SURFACE=cowork node "$PLUGIN/scripts/ndz-pickup.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
python3 - "$OUT" <<'PY' && ok "19 Cowork pickup, no local notes: additionalContext names \$HOME/mnt/<folder>/NOTES.md, no sessionTitle" || fail "19 cowork pickup" "code=$CODE out=$OUT err=$ERR"
import json, sys
d = json.loads(sys.argv[1])["hookSpecificOutput"]
assert d["hookEventName"] == "UserPromptSubmit"
assert "sessionTitle" not in d, d
assert "$HOME/mnt/<folder>/NOTES.md" in d["additionalContext"], d
assert "request access" in d["additionalContext"], d
PY

OUT=$(echo '{"session_id":"c1","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"again"}' | NDZ_SURFACE=cowork node "$PLUGIN/scripts/ndz-pickup.js" 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "20 Cowork pickup second prompt: silent" || fail "20 cowork second prompt" "out=$OUT"

# a NOTES.md that IS on this filesystem still wins, even in Cowork (staged or local Cowork)
printf '# agency: intake form (2)\n\n## Next steps\n1. wire the webhook\n' > "$CLAUDE_PROJECT_DIR/NOTES.md"
OUT=$(echo '{"session_id":"c2","cwd":"'"$CLAUDE_PROJECT_DIR"'","prompt":"x"}' | NDZ_SURFACE=cowork node "$PLUGIN/scripts/ndz-pickup.js" 2>"$T/err"); CODE=$?
python3 - "$OUT" <<'PY' && ok "21 Cowork pickup with local notes: reads them as usual" || fail "21 cowork local notes" "code=$CODE out=$OUT"
import json, sys
d = json.loads(sys.argv[1])["hookSpecificOutput"]
assert "wire the webhook" in d["additionalContext"], d
PY

echo "== limit file =="

# $CLAUDE_PLUGIN_DATA/limit is honored when NDZ_LIMIT is unset, NDZ_LIMIT still wins, and pruning leaves the file alone
echo 100000 > "$CLAUDE_PLUGIN_DATA/limit"
touch -d '10 days ago' "$CLAUDE_PLUGIN_DATA/limit"
OUT=$(echo '{"session_id":"l1","transcript_path":"'"$BIG"'","stop_hook_active":false}' | NDZ_LIMIT= node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
[ $CODE -eq 2 ] && [[ "$ERR" == *"100,000 limit"* ]] && [ -f "$CLAUDE_PLUGIN_DATA/limit" ] \
  && ok "22 limit file: 180k over file limit 100k, exit 2, old limit file not pruned" || fail "22 limit file" "code=$CODE err=$ERR ls=$(ls $CLAUDE_PLUGIN_DATA)"
run_check '{"session_id":"l2","transcript_path":"'"$BIG"'","stop_hook_active":false}' 250000
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "23 NDZ_LIMIT=250000 beats limit file 100k: silent" || fail "23 env beats file" "code=$CODE err=$ERR"
echo "garbage" > "$CLAUDE_PLUGIN_DATA/limit"
OUT=$(echo '{"session_id":"l3","transcript_path":"'"$BIG"'","stop_hook_active":false}' | NDZ_LIMIT= node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [ -z "$OUT" ] && ok "24 unparseable limit file: default 250k, silent" || fail "24 bad limit file" "code=$CODE out=$OUT"
rm -f "$CLAUDE_PLUGIN_DATA/limit"

echo "== ndz-limit.js (/no-dumb-zone:limit) =="

# --data-dir is what the skill passes from ${CLAUDE_PLUGIN_DATA}; it must beat the env fallback
D2="$T/data2"
OUT=$(node "$PLUGIN/scripts/ndz-limit.js" --data-dir "$D2" 100k 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [ "$(cat "$D2/limit")" = "100000" ] && [ ! -f "$CLAUDE_PLUGIN_DATA/limit" ] && [[ "$OUT" == *"100,000"* ]] && [[ "$OUT" == *"was 250,000"* ]] \
  && ok "25 limit set 100k: writes 100000 to --data-dir only, reports old and new" || fail "25 limit set" "code=$CODE out=$OUT err=$(cat $T/err)"

# the hook honors what the script wrote, in that same dir
OUT=$(echo '{"session_id":"l4","transcript_path":"'"$BIG"'","stop_hook_active":false}' | NDZ_LIMIT= CLAUDE_PLUGIN_DATA="$D2" node "$PLUGIN/scripts/ndz-check.js" 2>"$T/err"); CODE=$?; ERR=$(cat "$T/err")
[ $CODE -eq 2 ] && [[ "$ERR" == *"100,000 limit"* ]] && ok "26 hook reads the limit the script wrote: 180k over 100k, exit 2" || fail "26 script->hook" "code=$CODE err=$ERR"

OUT=$(node "$PLUGIN/scripts/ndz-limit.js" --data-dir "$D2" show 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [[ "$OUT" == *"100,000 tokens (from the limit file)"* ]] && [[ "$OUT" == *"$D2/limit"* ]] && ok "27 limit show: names the file and the source" || fail "27 limit show" "code=$CODE out=$OUT"
OUT=$(NDZ_LIMIT=130000 node "$PLUGIN/scripts/ndz-limit.js" --data-dir "$D2" 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [[ "$OUT" == *"130,000 tokens (from NDZ_LIMIT)"* ]] && [[ "$OUT" == *"takes precedence"* ]] && ok "27b limit show with NDZ_LIMIT set: env wins, says so" || fail "27b show env" "code=$CODE out=$OUT"

OUT=$(node "$PLUGIN/scripts/ndz-limit.js" --data-dir "$D2" clear 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [ ! -f "$D2/limit" ] && [[ "$OUT" == *"250,000"* ]] && ok "28 limit clear: file gone, reports the default" || fail "28 limit clear" "code=$CODE out=$OUT ls=$(ls $D2)"

for bad in abc 0 -5 "1 2"; do
  OUT=$(node "$PLUGIN/scripts/ndz-limit.js" --data-dir "$D2" $bad 2>"$T/err"); CODE=$?
  [ $CODE -eq 1 ] && [ ! -f "$D2/limit" ] && [[ "$(cat $T/err)" == *"usage:"* ]] || { fail "29 limit rejects '$bad'" "code=$CODE out=$OUT err=$(cat $T/err)"; bad=FAILED; break; }
done
[ "$bad" != FAILED ] && ok "29 limit rejects abc, 0, -5, two args: exit 1, usage on stderr, no file"

# empty or unsubstituted --data-dir falls back to the hooks' own dataDir()
OUT=$(node "$PLUGIN/scripts/ndz-limit.js" --data-dir "" 0.5m 2>"$T/err"); CODE=$?
[ $CODE -eq 0 ] && [ "$(cat "$CLAUDE_PLUGIN_DATA/limit")" = "500000" ] && [[ "$OUT" == *"Above the 250,000 default"* ]] && ok "30 empty --data-dir: falls back to CLAUDE_PLUGIN_DATA, 0.5m parses, warns above default" || fail "30 fallback dir" "code=$CODE out=$OUT"
rm -f "$CLAUDE_PLUGIN_DATA/limit"

echo
echo "$PASS passed, $FAIL failed"
rm -rf "$T"
[ $FAIL -eq 0 ]
