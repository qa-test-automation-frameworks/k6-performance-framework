export function setTestEnv(env: Record<string, string | undefined>): void {
  Object.assign(globalThis, { __ENV: env });
}

setTestEnv({});
