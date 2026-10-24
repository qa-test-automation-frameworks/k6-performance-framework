function assertControlVerdict({ record, summary, env }) {
  const problems = [];
  const check = (condition, message) => {
    if (!condition) problems.push(message);
  };
  const counts = record?.execution?.counts ?? {};
  check(record?.scope?.id === 'k6.evidence-failure-control', 'record scope is not the failure control');
  check(record?.scope?.required === false, 'raw failure-control record must not be required');
  check(record?.execution?.disposition === 'failed', 'raw record disposition must be failed');
  check(record?.execution?.integrity === 'complete', 'raw record integrity must be complete');
  check(
    counts.selected === 1 &&
      counts.executed === 1 &&
      counts.passed === 0 &&
      counts.failed === 1 &&
      counts.skipped === 0,
    `raw record counts must be 1/1/0/1/0, got ${JSON.stringify(counts)}`,
  );
  check(record?.sourceSha === env?.GITHUB_SHA, 'raw record sourceSha differs from GITHUB_SHA');
  check(
    record?.workflow?.runId === env?.GITHUB_RUN_ID,
    'raw record runId differs from GITHUB_RUN_ID',
  );
  check(
    record?.workflow?.attempt === Number(env?.GITHUB_RUN_ATTEMPT),
    'raw record attempt differs from GITHUB_RUN_ATTEMPT',
  );
  const failures = summary?.failures;
  check(
    Array.isArray(failures) &&
      failures.length === 2 &&
      failures.includes('Checks: 1 failed') &&
      failures.some((failure) => String(failure).startsWith('Threshold: checks:')),
    'summary failures must be exactly the failed check and its threshold breach',
  );
  check(
    summary?.metrics?.checks?.fails === 1 && summary?.metrics?.checks?.passes === 0,
    'summary checks must show 1 fail and 0 passes',
  );
  if (problems.length) throw new Error(`Failure-control verdict rejected: ${problems.join('; ')}`);
}

module.exports = { assertControlVerdict };
