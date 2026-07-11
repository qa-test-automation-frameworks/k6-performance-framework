# Real-Service Performance Experiment Guide

Before adapting this framework to a real service, document the approved target,
workload model, data-isolation strategy, SLO owner, runner class, capacity limits,
and stop conditions. Hosted GitHub runners are suitable for comparative evidence,
not automatically for production capacity claims. Every result must identify target
and framework SHAs, profile, runner, duration, baseline compatibility, and whether
traffic was read-only. Local controlled-target SLOs remain demonstrations, not
production SLOs.
