# Contributing

## Development

Use Node.js 20 LTS or newer.

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

## Pull Requests

- Keep changes scoped to the capability being implemented.
- Run typecheck and lint before opening a PR.
- Do not commit generated runtime output from `dist/`, `reports/`, or baseline JSON files unless a later phase explicitly requires it.
- Prefer strict TypeScript types and avoid `any`.
- Use `TEST_PROFILE=validation` before full-duration performance runs.
- Do not direct write-heavy or sustained traffic at public targets.
- Include summary or baseline evidence when changing thresholds.
