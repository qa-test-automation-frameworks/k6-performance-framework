import { getConfig } from '../../config';

export interface LoadTargetPolicy {
  workload: string;
  write?: boolean;
}

/**
 * Rejects sustained or write-heavy traffic against non-local targets unless explicitly approved.
 * @param policy Workload identity and whether it mutates target data.
 */
export function assertAuthorizedLoadTarget(policy: LoadTargetPolicy): void {
  const config = getConfig();
  if (config.environment !== 'local' && __ENV.ALLOW_NON_LOCAL_LOAD !== 'true') {
    throw new Error(
      `${policy.workload} ${policy.write ? 'write' : 'load'} traffic requires local TARGET_ENV or ALLOW_NON_LOCAL_LOAD=true`,
    );
  }
}

/** @throws When a write workload targets a non-local environment without explicit authorization. */
export function assertWriteTarget(): void {
  assertAuthorizedLoadTarget({ workload: 'Authenticated', write: true });
}
