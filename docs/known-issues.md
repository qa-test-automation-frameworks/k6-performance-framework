# Known Issues

| Area | Status | Workaround |
| --- | --- | --- |
| Public target safety | Write-heavy workloads are not safe against shared public targets | Use the controlled local target for load, stress, and baseline updates |
| Single-request 500/s experiment | The counting fixture is not RealWorld capacity evidence; generator capacity can invalidate load | Reject under-driven/dropped runs; report the actual achieved rate and owned-target resource limits |
| Long-running evidence | Soak and distributed runs are manual or scheduled | Keep PR gates on bounded validation profiles |
