# Contributing

## Development

Use Node.js 20 LTS or newer.

```bash
npm ci
npm run typecheck
npm run lint
```

## Pull Requests

- Keep changes scoped to the roadmap phase being implemented.
- Run typecheck and lint before opening a PR.
- Do not commit generated runtime output from `dist/`, `reports/`, or baseline JSON files unless a later phase explicitly requires it.
- Prefer strict TypeScript types and avoid `any`.
