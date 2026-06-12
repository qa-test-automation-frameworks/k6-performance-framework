#!/usr/bin/env bash
set -euo pipefail
export TEST_PROFILE="${TEST_PROFILE:-validation}"
npm run load
cp reports/load-results.json "baseline/load-$(date +%Y%m%d-%H%M%S).json"
