#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

artifact_endpoint="repos/${GITHUB_REPOSITORY}/actions/artifacts?per_page=100"
artifact_list="${temp_dir}/artifacts.tsv"
gh api --paginate \
  --jq '.artifacts[] | select(.name == "load-results" and .expired == false) | [.id, .workflow_run.id] | @tsv' \
  "$artifact_endpoint" >"$artifact_list"

imported=0
declare -A seen_runs=()
while IFS=$'\t' read -r artifact_id run_id; do
  [[ "$artifact_id" =~ ^[0-9]+$ && "$run_id" =~ ^[0-9]+$ ]] || continue
  if [[ -n "${seen_runs[$run_id]:-}" ]]; then
    continue
  fi
  seen_runs[$run_id]=1

  run_status="$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${run_id}" --jq '[.head_branch, .conclusion] | @tsv')"
  IFS=$'\t' read -r head_branch conclusion <<<"$run_status"
  if [[ "$head_branch" != "main" || "$conclusion" != "success" ]]; then
    continue
  fi

  archive="${temp_dir}/${artifact_id}.zip"
  extract_dir="${temp_dir}/${artifact_id}"
  gh api "repos/${GITHUB_REPOSITORY}/actions/artifacts/${artifact_id}/zip" >"$archive"
  mkdir -p "$extract_dir"
  unzip -q "$archive" -d "$extract_dir"
  summary="$(find "$extract_dir" -type f -name load-summary.json -print -quit)"
  if [[ -n "$summary" ]]; then
    cp "$summary" "reports/load-${run_id}-summary.json"
    printf 'Imported load summary from artifact %s (run %s).\n' "$artifact_id" "$run_id"
    imported=$((imported + 1))
  else
    printf 'Skipped artifact %s (run %s): load-summary.json was not present.\n' "$artifact_id" "$run_id"
  fi
done <"$artifact_list"

printf 'Imported %s retained main-branch load summary file(s).\n' "$imported"
