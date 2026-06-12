import { getConfig } from '../../config';

export function assertWriteTarget(): void {
  const config = getConfig();
  if (config.environment !== 'local' && __ENV.ALLOW_NON_LOCAL_LOAD !== 'true') {
    throw new Error(
      'Write and high-load tests require local TARGET_ENV or ALLOW_NON_LOCAL_LOAD=true',
    );
  }
}
