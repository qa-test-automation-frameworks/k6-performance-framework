export function setTestEnv(env: Record<string, string | undefined>): void {
  Object.assign(globalThis, { __ENV: env });
}

setTestEnv({});
Object.assign(globalThis, { __ITER: 0, __VU: 1 });
