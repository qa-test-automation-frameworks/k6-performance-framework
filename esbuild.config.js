const esbuild = require('esbuild');
const glob = require('glob');

const entryPoints = glob.sync('tests/**/*.ts', {
  ignore: ['tests/unit/**', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
});

if (entryPoints.length === 0) {
  console.log('No k6 test entry points found yet. Skipping build.');
  process.exit(0);
}

esbuild
  .build({
    entryPoints,
    bundle: true,
    platform: 'node',
    target: 'es2022',
    outdir: 'dist',
    outbase: 'tests',
    external: ['k6', 'k6/*'],
    sourcemap: 'inline',
    allowOverwrite: true,
    emptyOutdir: true,
  })
  .catch(() => process.exit(1));
