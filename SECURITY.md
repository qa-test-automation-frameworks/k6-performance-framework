# Security Policy

Report suspected credential exposure or vulnerabilities privately through GitHub Security Advisories.
Do not open a public issue containing tokens, credentials, exploit details, or customer data.

The repository accepts security fixes for the current minor release. Dependency, lockfile, and
tracked-file secret scans run in CI. Runtime credentials must be provided through environment
variables and must never be committed.

The local observability stack uses development defaults for Grafana and InfluxDB. Do not expose
the Docker Compose ports outside a developer workstation without changing those credentials.
