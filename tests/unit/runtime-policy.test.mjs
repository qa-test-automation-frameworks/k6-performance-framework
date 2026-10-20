import { describe, expect, it } from 'vitest';
import toolchain from '../../scripts/check-npm-version.cjs';

describe('supported Node runtime policy', () => {
  it.each(['24.21.0', '24.21.1', '24.22.0'])(
    'accepts %s under the declared major policy',
    (version) => {
      expect(() => toolchain.assertSupportedNode(version)).not.toThrow();
    },
  );

  it.each([
    '18.20.0',
    '20.19.0',
    '22.20.0',
    '24.19.0',
    '24.20.9',
    '24.21.0-rc.1',
    '25.0.0',
    '26.0.0',
    'unknown',
  ])('rejects %s with an actionable bootstrap message', (version) => {
    expect(() => toolchain.assertSupportedNode(version)).toThrow('Install the version in .nvmrc');
  });
});
