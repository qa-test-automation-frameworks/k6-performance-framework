# Known Issues

| Area | Status | Workaround |
| --- | --- | --- |
| Public target safety | Write-heavy workloads are not safe against shared public targets | Use the controlled local target for load, stress, and baseline updates |
| 500 RPS profile | Runner capacity can limit arrival-rate accuracy | Treat dropped iterations as a failed run and rerun on a larger host |
| Long-running evidence | Soak and distributed runs are manual or scheduled | Keep PR gates on bounded validation profiles |
