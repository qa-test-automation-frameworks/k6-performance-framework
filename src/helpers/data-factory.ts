let sequence = 0;

export function uniqueSuffix(): string {
  sequence += 1;
  const vu = typeof __VU === 'number' ? __VU : 0;
  const iteration = typeof __ITER === 'number' ? __ITER : 0;
  return `${Date.now()}-${vu}-${iteration}-${sequence}`;
}
