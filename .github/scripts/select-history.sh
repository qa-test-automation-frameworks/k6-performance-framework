#!/usr/bin/env bash
set -euo pipefail

case "${SCENARIO:?SCENARIO is required}" in
  stress|spike|soak) filename="${SCENARIO}-summary.json" ;;
  breakpoint) filename='breakpoint-capacity.json'; CANDIDATE_FILE=reports/breakpoint-capacity.json; export CANDIDATE_FILE ;;
  *) echo 'Unsupported historical scenario' >&2; exit 1 ;;
esac
: "${CANDIDATE_FILE:?CANDIDATE_FILE is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

mkdir -p reports/history
# Reject a malformed current identity before treating old data as unavailable.
if [ "$SCENARIO" != 'breakpoint' ]; then
  node scripts/check-history-identity.cjs "$CANDIDATE_FILE" "$CANDIDATE_FILE"
fi
# Same-code scheduled runs are useful history. Exclude this run ID, not its SHA.
# API failure remains failure, rather than an empty list that looks like first use.
gh run list --workflow scheduled-soak.yml --branch main --status success --limit 20 \
  --json databaseId --jq '.[].databaseId' > reports/history-candidates.txt

previous_run=''
previous_file=''
while read -r run_id; do
  [ -n "$run_id" ] || continue
  [[ "$run_id" =~ ^[0-9]+$ ]] || { echo 'Invalid historical run ID' >&2; exit 1; }
  [ "$run_id" != "$GITHUB_RUN_ID" ] || continue
  rm -rf reports/history/*
  if ! gh run download "$run_id" --name "advanced-${SCENARIO}-full" --dir reports/history; then
    continue
  fi
  # Artifacts can themselves contain history/. Select only the primary result.
  previous_file="reports/history/$filename"
  [ -f "$previous_file" ] || continue
  if [ "$SCENARIO" != 'breakpoint' ] && ! node scripts/check-history-identity.cjs "$previous_file" "$CANDIDATE_FILE"; then
    continue
  fi
  previous_run="$run_id"
  break
done < reports/history-candidates.txt

if [ -z "$previous_run" ]; then
  echo 'available=false' >> "$GITHUB_OUTPUT"
  echo 'Historical comparison unavailable: no retained compatible primary input. Absolute workload thresholds are separate.'
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo 'Historical comparison: **UNAVAILABLE**, not a passed comparison. No retained compatible primary input; absolute thresholds are separate.' >> "$GITHUB_STEP_SUMMARY"
  fi
  node - <<'NODE'
const fs = require('node:fs');
fs.writeFileSync('reports/history-selection.json', JSON.stringify({schema: 'k6-history-selection-v1', disposition: 'unavailable', reason: 'no_retained_compatible_primary_input', currentRunId: process.env.GITHUB_RUN_ID, candidateFile: process.env.CANDIDATE_FILE}, null, 2) + '\n');
NODE
else
  echo 'available=true' >> "$GITHUB_OUTPUT"
  echo "previous_file=$previous_file" >> "$GITHUB_OUTPUT"
  HISTORY_RUN_ID="$previous_run" HISTORY_FILE="$previous_file" node - <<'NODE'
const fs = require('node:fs');
fs.writeFileSync('reports/history-selection.json', JSON.stringify({schema: 'k6-history-selection-v1', disposition: 'available', selectedRunId: process.env.HISTORY_RUN_ID, previousFile: process.env.HISTORY_FILE, currentRunId: process.env.GITHUB_RUN_ID, candidateFile: process.env.CANDIDATE_FILE}, null, 2) + '\n');
NODE
fi
