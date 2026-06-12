# ADR-004: RealWorld API Target and Safety Policy

## Status

Accepted

## Date

2026-06-12

## Decision

Use the RealWorld API contract for all service objects. Read-only smoke checks may target the
public API at `https://api.realworld.show/api`. Authenticated writes and sustained load default to
the local environment and require `ALLOW_NON_LOCAL_LOAD=true` elsewhere.

Authentication data is supplied at runtime as a JSON string array in `K6_USER_TOKENS` and shared
across VUs with `SharedArray`. Secrets and generated credentials are never committed.

## Consequences

The framework has stable endpoint tags and typed request/response contracts. Destructive or
high-volume tests fail early unless the target policy is explicitly overridden.
