# ADR-001: TypeScript over JavaScript

## Status
Accepted

## Date
2026-06-09

## Context
The framework needs to demonstrate Staff SDET-level engineering discipline while supporting k6 performance tests, reusable service objects, typed configuration, and maintainable test data contracts.

## Decision
Use TypeScript 5.4+ instead of plain JavaScript for source, configuration, scenarios, and tests.

## Rationale
TypeScript provides type safety, IDE completions, and compile-time guardrails with no runtime cost in k6 after bundling. Strict compiler settings also support the framework's zero-`any` standard and make the portfolio codebase easier to review.

## Consequences
The project requires a build step before k6 execution. Contributors must maintain explicit request, response, config, and scenario types as the framework grows.

## Alternatives Considered

| Option | Pros | Cons | Rejected Because |
|--------|------|------|------------------|
| JavaScript | Native k6 authoring, no compile step | Weaker contracts, fewer guardrails, less portfolio signal | Does not meet the strict typing and maintainability goals |
| TypeScript | Strong types, IDE support, zero runtime cost after bundling | Requires build tooling | Best fit for production-grade maintainability |
