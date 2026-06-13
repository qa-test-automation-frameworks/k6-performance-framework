/**
 * Serializes defined object properties into a URL query string.
 * @param params Query parameter object.
 * @returns An encoded query string, or an empty string when no values are defined.
 */
export function toQuery<T extends object>(params: T): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  );
  return entries.length
    ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`
    : '';
}
