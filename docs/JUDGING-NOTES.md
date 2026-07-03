# Judging notes

A direct map from the **BasedAI Permission-Aware Memory Challenge** brief to
where each requirement is implemented, tested, and demonstrated.

## Core requirements

| Bounty requirement | Where it lives | Proof |
|---|---|---|
| **Stays synchronized with source ACLs under concurrent updates** | Access is never copied onto derivatives; every read recomputes from live source state (`resolve` in [`engine.js`](../src/engine.js)). There is no derived-permission cache to fall out of sync. | [`test/revocation.test.js`](../test/revocation.test.js) — revoke/restore reflect on the next read for all viewers |
| **Enforcement at the retrieval layer, no LLM call for the permission decision** | `canRead()` is pure set logic; the decision path imports nothing that calls a model. Classification *may* use an LLM at write time only. | [`test/engine.test.js`](../test/engine.test.js) *"decisions are deterministic"*; console stat *"Deterministic · 0 LLM calls"* |
| **Audit logs meeting regulatory standards** | Hash-chained, append-only ledger; each entry carries principal, object, decision, human-readable rule, latency, and `prev→hash` link. Batches anchor to Hedera HCS. | [`test/audit.test.js`](../test/audit.test.js) — chain verifies; tamper detected at exact seam. Sample: [`scenarios/sample-audit-log.json`](../scenarios/sample-audit-log.json) |
| **Sub-200ms P99 permission checks** | Pure computation, O(sources per node). | `npm run bench` → **P99 ≈ 0.38µs**, ~500,000× under budget. [`bench/p99.js`](../bench/p99.js) |
| **Governs derived memory by lineage; revoking a source propagates to derivatives** | Derivatives store lineage only; audience = per-source intersection. Revocation → ∅ on next read. | [`test/revocation.test.js`](../test/revocation.test.js); live in the demo (REVOKED stamp) |

## Bonus challenges

| Bonus | Status | Where |
|---|---|---|
| **Temporal access rules** ("unlock after 30 days") | ✅ Implemented | `effectiveAudience` time-lock in [`engine.js`](../src/engine.js); [`test/temporal.test.js`](../test/temporal.test.js); demo *Advance +30 days* |
| **Query-time inference prevention** (cross-boundary leakage) | ✅ Metadata channel; scope stated honestly | [`inference.js`](../src/inference.js); [`test/inference.test.js`](../test/inference.test.js); [`SECURITY-MODEL.md`](SECURITY-MODEL.md) draws the line at content-level statistical inference |

## Judge checklist (from the submission guide)

- [x] Clear problem in first 10 seconds — see README opening + [DEMO-SCRIPT](DEMO-SCRIPT.md)
- [x] Working demo — `make demo`, verified in-browser (screenshots in `docs/screenshots/`)
- [x] Architecture diagram — [ARCHITECTURE.md](ARCHITECTURE.md) (component + sequence + lineage, Mermaid)
- [x] README understandable alone — top-level [README](../README.md)
- [x] Precise security claim, no overclaiming — [SECURITY-MODEL.md](SECURITY-MODEL.md) with explicit scope boundaries
- [x] One-command run — `make demo` / `docker compose up` / `npm run demo`
- [x] Sample audit logs + permission scenarios without running — [`scenarios/`](../scenarios/)
- [x] Reusable — one dependency-free engine imported by demo, API, tests, bench; `npm i` needs nothing
- [x] Next step: API / SDK / pilots — see [Roadmap](../README.md#roadmap)

## How to verify in 60 seconds

```bash
node --test            # 31 invariant tests, 0 deps
node bench/p99.js      # sub-200ms P99, printed
npm run demo           # open http://localhost:4173 and revoke SRC-01
cat scenarios/decision-matrix.json   # the full persona × memory truth table
```
