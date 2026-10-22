#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
mock_bin="${temp_dir}/bin"
work_dir="${temp_dir}/site-build"
mkdir -p "$mock_bin" "$work_dir"

cat >"${mock_bin}/gh" <<'MOCK_GH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$GH_CALL_LOG"
api_path=""
for argument in "$@"; do
  if [[ "$argument" == repos/* ]]; then
    api_path="$argument"
  fi
done

case "$api_path" in
  */actions/artifacts\?per_page=100)
    case " $* " in
      *" --slurp "*) echo "--slurp cannot be used with --jq" >&2; exit 1 ;;
      *" --paginate "*) ;;
      *) echo "artifact lookup did not paginate" >&2; exit 1 ;;
    esac
    printf '101\t501\n102\t502\n103\t503\n104\t504\n'
    ;;
  */actions/runs/501|*/actions/runs/504)
    printf 'main\tsuccess\n'
    ;;
  */actions/runs/502)
    printf 'release\tsuccess\n'
    ;;
  */actions/runs/503)
    printf 'main\tfailure\n'
    ;;
  */actions/artifacts/101/zip)
    printf 'root-summary-archive'
    ;;
  */actions/artifacts/104/zip)
    printf 'nested-summary-archive'
    ;;
  *)
    echo "unexpected GitHub API request: $api_path" >&2
    exit 1
    ;;
esac
MOCK_GH

cat >"${mock_bin}/unzip" <<'MOCK_UNZIP'
#!/usr/bin/env bash
set -euo pipefail
archive="$2"
destination=""
while (($#)); do
  if [[ "$1" == "-d" ]]; then
    destination="$2"
    shift 2
  else
    shift
  fi
done
mkdir -p "$destination"
case "$(basename "$archive")" in
  101.zip)
    printf '{"fixture":"root"}\n' >"${destination}/load-summary.json"
    ;;
  104.zip)
    mkdir -p "${destination}/reports"
    printf '{"fixture":"nested"}\n' >"${destination}/reports/load-summary.json"
    ;;
  *)
    echo "unexpected archive: $archive" >&2
    exit 1
    ;;
esac
MOCK_UNZIP

chmod +x "${mock_bin}/gh" "${mock_bin}/unzip"
export GITHUB_REPOSITORY="qa-test-automation-frameworks/k6-performance-framework"
export GH_CALL_LOG="${temp_dir}/gh-calls.log"
export PATH="${mock_bin}:${PATH}"

output="$(cd "$work_dir" && bash "${repo_root}/scripts/download-report-history.sh")"
printf '%s\n' "$output"
[[ "$output" == *"Imported load summary from artifact 101 (run 501)."* ]]
[[ "$output" == *"Imported load summary from artifact 104 (run 504)."* ]]
[[ "$output" == *"Imported 2 retained main-branch load summary file(s)."* ]]
[[ -f "${work_dir}/reports/load-501-summary.json" ]]
[[ -f "${work_dir}/reports/load-504-summary.json" ]]
[[ ! -e "${work_dir}/reports/load-502-summary.json" ]]
[[ ! -e "${work_dir}/reports/load-503-summary.json" ]]
grep -q '"fixture":"root"' "${work_dir}/reports/load-501-summary.json"
grep -q '"fixture":"nested"' "${work_dir}/reports/load-504-summary.json"
grep -q -- '--paginate' "$GH_CALL_LOG"

printf 'All report-history download checks passed.\n'
