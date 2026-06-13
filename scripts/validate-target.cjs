const target = new URL(process.env.BASE_URL);
const allowlist = (process.env.PERFORMANCE_TARGET_ALLOWLIST || '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

if (!allowlist.includes(target.hostname.toLowerCase())) {
  throw new Error(`Target host ${target.hostname} is not in PERFORMANCE_TARGET_ALLOWLIST`);
}
