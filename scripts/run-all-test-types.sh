#!/usr/bin/env bash
set -euo pipefail
export TEST_PROFILE="${TEST_PROFILE:-validation}"
for test_name in smoke load stress spike soak breakpoint; do
  npm run "$test_name"
done
