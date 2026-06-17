#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

gh api \
  "repos/${GITHUB_REPOSITORY}/actions/artifacts?per_page=20" \
  --jq '.artifacts[] | select(.name == "load-results" and .expired == false) | [.id, .workflow_run.id] | @tsv' |
  while IFS=$'\t' read -r artifact_id run_id; do
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
    if [[ -f "${extract_dir}/load-summary.json" ]]; then
      cp "${extract_dir}/load-summary.json" "reports/load-${run_id}-summary.json"
    fi
  done
