# Observability output integrity repair

At exactcb8cfb8, [native Docker run37201276341](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37201276341)
passed the owned-target authorization repair, workload, telemetry presence validator
and image capture. Native probe: four completed iterations/eight HTTP requests,
zero interruptions/errors. This is a bounded telemetry probe, not a load/capacity
measurement or a soak stability experiment.

Inspection of artifact11302804058 nevertheless found an announcement overlay
covering the overview and failed panel queries. Native Grafana logs show string
aggregation errors and a numeric/string schema collision; the original validator
only checked measurement presence, dashboard existence and generic annotations.
The successful run therefore did not certify usable dashboards. Original summary,
API metadata, query errors and blocked PNG are retained with hashes.

## Repair and gate

- Provisioned Flux filters `_field == "value"` before aggregation/grouping,
  excluding exported string fields. The10-second request count panel divides by10
  to express a per-second window average rather than mislabeled counts.
- The validator executes the actual provisioned Flux for this run/environment and
  writes per-query row counts/dispositions. Missing required queries fail; the
  write latency and business-error counter may be unavailable in a read-only probe
  and are explicitly recorded that way, never filled with invented zero samples.
- CI supplies the actual run ID and requires a nonexistent run to fail specifically
  for missing run-scoped rows. Start/end annotations must belong to this run and
  the end annotation must report status0. Network calls have30-second bounds.
- The mounted Grafana13 config disables only the `splashScreen` feature for
  unattended capture; kiosk mode removes navigation chrome. The
  [v13.0.2 AppChrome source](https://github.com/grafana/grafana/blob/v13.0.2/public/app/core/components/AppChrome/AppChrome.tsx),
  [feature config](https://github.com/grafana/grafana/blob/v13.0.2/conf/defaults.ini)
  and [kiosk documentation](https://grafana.com/docs/grafana/latest/visualizations/dashboards/use-dashboards/)
  were checked. Query filters use the
  [Flux data model](https://docs.influxdata.com/flux/v0/spec/data-model/).

Syntax/format/actionlint checks passed locally. Local Docker is unavailable;
actual Flux execution, the negative run control and new PNG visual inspection
remain pending until the new exact-revision integration runs. The general
Prometheus presence check does not establish a valid OTEL request-rate chart
for a short probe with insufficient counter scrapes. Full soak/write and D04
measurement evidence remain separate.

## Native provisioned-query result and follow-up

At exactd7e8c73, [Docker37201994516](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37201994516)
passed actual provisioned Flux, run annotations, nonexistent-run rejection and
rendering. Artifact11303475963 records12 required query results and two optional
unavailable read-probe metrics. The missing-run control records no required rows
and native exit1 with the intended reason. The inspected overview now has no
splash overlay and displays read/error/duration data; write/business metrics and
the OTEL rate remain unavailable for this bounded probe.

Two details were tightened after inspecting that result. Flux aggregateWindow
emits empty windows; the CSV gate now counts finite numeric values, including
zero, rather than counting every table row. Five parser controls reject header/
empty-window-only evidence and non-numeric values and preserve quoted tag values.
The installed v13.0.2
[AppChromeService](https://github.com/grafana/grafana/blob/v13.0.2/public/app/core/components/AppChrome/AppChromeService.tsx)
accepts kiosk1, so capture now uses that value instead of the ineffective legacy tv
value. The existing d7e8 PNG still includes navigation and is labeled accordingly.
The new numeric-row and kiosk changes require their own exact-revision run.

## Numeric samples and inspected renders

At exact860feb2, [Docker37202532056](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37202532056)
passed all12 required provisioned queries with finite numeric values, including
zero-valued error samples. Positive records now report2/4 actual numeric values
where the previous implementation counted61/122 rows containing empty windows.
The nonexistent-run control still failed with the intended reason; optional write
and business-error metrics remained unavailable. The overview, endpoint and soak
PNGs were visually inspected: no announcement overlay/navigation chrome, actual
read/error/duration samples displayed. These tiny-probe images remain distinct
from a long-running soak/load experiment; the OTEL-rate panel has no data.

Inspection also exposed an automatic endpoint percentage axis reaching10000%.
The provisioned error panels now explicitly use fraction-to-percent display with
min0/max1, matching the exporter mean's0..1 domain. This final display correction
needs native rendering at the subsequent revision; it does not change metric data
or thresholds. Native860feb2 records/images remain labeled with that tested head.
