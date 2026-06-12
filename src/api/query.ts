export function toQuery<T extends object>(params: T): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string | number] =>
    entry[1] !== undefined,
  );
  return entries.length
    ? `?${entries.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')}`
    : '';
}
