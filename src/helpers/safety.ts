import { getConfig } from '../../config';

/** @throws When a write workload targets a non-local environment without explicit authorization. */
export function assertWriteTarget(): void {
  const config = getConfig();
  if (config.environment !== 'local' && __ENV.ALLOW_NON_LOCAL_LOAD !== 'true') {
    throw new Error(
      'Write and high-load tests require local TARGET_ENV or ALLOW_NON_LOCAL_LOAD=true',
    );
  }
}
