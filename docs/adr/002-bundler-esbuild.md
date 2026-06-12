# ADR-002: esbuild over webpack

## Status

Accepted

## Date

2026-06-09

## Context

k6 executes bundled JavaScript and provides k6 modules at runtime. The framework needs a fast, simple build pipeline that can compile TypeScript test entry points into a mirrored `dist/` tree.

## Decision

Use esbuild's JavaScript API with globbed `tests/**/*.ts` entry points and externalized `k6` modules.

## Rationale

esbuild provides very fast cold builds and a compact configuration while satisfying k6's CommonJS and external module requirements. The build remains easy for contributors to understand and maintain.

## Consequences

The build configuration stays intentionally small. Advanced bundling needs should be evaluated carefully before adding complexity.

## Alternatives Considered

| Option  | Pros                                            | Cons                                                  | Rejected Because                                  |
| ------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| webpack | Mature ecosystem, many plugins                  | Larger config surface, slower setup, more maintenance | Unnecessary for the framework's k6 bundling needs |
| esbuild | Fast, simple, enough for k6 TypeScript bundling | Fewer advanced plugin features                        | Best balance of speed, simplicity, and fit        |
