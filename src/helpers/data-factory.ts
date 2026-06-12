let sequence = 0;

export function uniqueSuffix(): string {
  sequence += 1;
  return `${Date.now()}-${__VU ?? 0}-${__ITER ?? 0}-${sequence}`;
}
