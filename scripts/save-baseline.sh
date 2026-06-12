#!/usr/bin/env bash
set -euo pipefail
export TEST_PROFILE="${TEST_PROFILE:-validation}"
export SUMMARY_NAME="${SUMMARY_NAME:-load}"
npm run load
cp reports/load-summary.json "baseline/load-$(date +%Y%m%d-%H%M%S)-summary.json"
