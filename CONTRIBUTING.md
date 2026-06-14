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

- Keep changes scoped to the roadmap phase being implemented.
- Run typecheck and lint before opening a PR.
- Do not commit generated runtime output from `dist/`, `reports/`, or baseline JSON files unless a later phase explicitly requires it.
- Prefer strict TypeScript types and avoid `any`.
- Use `TEST_PROFILE=validation` before full-duration performance runs.
- Do not direct write-heavy or sustained traffic at public targets.
- Include summary or baseline evidence when changing thresholds.

## Adding Endpoint Coverage

- Add typed service methods with stable request names such as `GET /articles/:slug`.
- Assign every request to a bounded business metric group.
- Add endpoint and business-metric thresholds for the new path.
- Cover request shape, tags, and failure handling in unit tests.
- Update Grafana dashboard queries when the endpoint needs first-class review.
