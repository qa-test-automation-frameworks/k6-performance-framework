# ADR-003: InfluxDB v2, Grafana, and OpenTelemetry Collector

## Status

Accepted

## Date

2026-06-11

## Context

The framework needs local, inspectable performance telemetry without requiring a paid hosted account. It must also demonstrate dashboard provisioning and standards-based telemetry routing.

## Decision

Use InfluxDB v2 for local time-series storage, Grafana for visualization, and OpenTelemetry Collector for telemetry routing. Keep k6 Cloud optional rather than required.

## Rationale

The stack is self-hosted, reproducible with Docker Compose, customizable, and suitable for portfolio demonstrations. OpenTelemetry provides a vendor-neutral integration point for future backends.

## Consequences

Contributors must run and maintain a multi-container local stack. Dashboard and collector compatibility must be validated when component versions change.

## Alternatives Considered

| Option                      | Pros                                              | Cons                                                 | Rejected Because                                       |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| k6 Cloud                    | Managed storage and dashboards                    | Account dependency and hosted-service limits         | Does not demonstrate local observability engineering   |
| Prometheus and Grafana      | Familiar ecosystem                                | Requires a k6 remote-write path and additional setup | InfluxDB is the roadmap's direct k6 output target      |
| InfluxDB, Grafana, and OTEL | Self-hosted, customizable, vendor-neutral routing | More components to operate                           | Best fit for local reproducibility and portfolio depth |
