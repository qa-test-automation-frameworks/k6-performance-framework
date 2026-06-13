import { SharedArray } from 'k6/data';

const tokens = new SharedArray<string>('user tokens', () => {
  const raw = __ENV.K6_USER_TOKENS;
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error('K6_USER_TOKENS must be a JSON array of strings');
  }
  return parsed;
});

/**
 * Selects a shared authentication token deterministically for a virtual user.
 * @param vu k6 virtual-user number.
 * @returns The token assigned to the virtual user.
 * @throws When no valid token array was provided.
 */
export function tokenForVu(vu = __VU): string {
  if (tokens.length === 0) throw new Error('K6_USER_TOKENS is required for authenticated tests');
  return tokens[(vu - 1) % tokens.length]!;
}
