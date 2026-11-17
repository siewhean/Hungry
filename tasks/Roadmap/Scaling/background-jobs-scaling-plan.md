# Background Jobs Scaling Plan

Date: 2026-06-07
Status: plan only, no jobs table added in this pass

## Rule

Slow or expensive work must not run inline on user-critical paths once the app scales beyond beta. Queueing can be implemented after staging requirements are confirmed.

## Workloads To Queue

| Workload | Queue reason |
| --- | --- |
| OCR/menu photo ingestion | Slow image processing and possible retries |
| Bulk imports and enrichment | Large row counts and external-source throttling |
| Media compression/transcoding | CPU-heavy and failure-prone |
| Analytics aggregation | Avoid repeated hot read aggregation |
| Notifications/email | Retry, dedupe, provider failure handling |
| Account deletion | Multi-table destructive workflow with audit requirements |
| Weekly merchant summaries | Scheduled aggregation and fan-out |

## Queue Contract

- Job payloads contain only IDs and minimal metadata.
- Jobs are idempotent by `dedupe_key`.
- Jobs track `queued`, `running`, `succeeded`, `failed`, `dead_lettered`.
- Retries use bounded exponential backoff.
- Workers write structured logs and audit records for sensitive operations.
- User-facing flows receive an accepted/pending state, not a spinner waiting for the whole job.

## Implementation Options

1. Supabase table-backed queue plus scheduled Edge Functions for MVP beta.
2. Dedicated queue provider for higher throughput after launch.
3. Hybrid approach: table-backed outbox for canonical writes, external workers for expensive processors.

## Current Decision

No queue migration is added in this pass because the request is repo-local scaling foundation and no exact existing schema gap required an additive queue table today.
