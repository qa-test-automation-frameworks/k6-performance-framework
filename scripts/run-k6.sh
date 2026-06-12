#!/usr/bin/env bash
set -euo pipefail

test_name="${1:?usage: run-k6.sh <smoke|load|stress|spike|soak|breakpoint>}"
export TEST_PROFILE="${TEST_PROFILE:-validation}"
npm run "$test_name"
