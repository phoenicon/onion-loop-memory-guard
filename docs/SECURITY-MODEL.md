# Security model

A precise claim, stated narrowly, with the threats it does and does not cover.
The hackathon guide's rule was *"precise security claim · no overclaiming."* This
document holds us to it.

## The claim

> For any viewer, at any clock time, a memory is readable **iff** the viewer is
> individually cleared for **every** source in that memory's lineage. The
> decision is deterministic, requires no model call, and is recorded in a
> tamper-evident log.

That is the whole guarantee. Everything else is a consequence of it.

## What this defends

| Threat | Defence |
|---|---|
| **Summary/embedding leakage** — a derived memory exposes restricted source content | A derivative's audience is the *intersection* of its sources; it can never be more permissive than its most restrictive parent. |
| **Stale permissions after a change** | Access is never cached on the derivative. Revoke a source and the next read recomputes to ∅ — nothing to invalidate. |
| **Prompt-injection of the permission decision** | The model is not on the decision path. No prompt can talk the gate into "just this once." |
| **Metadata / side-channel inference** — learning a confidential item *exists* from a denied result's title or lineage | Denied nodes are returned as opaque tombstones (`{id, visible:false}`). `auditLeaks()` asserts no exposed field references an uncleared source. |
| **Cross-document reconstruction** — combining individually-returned memories to rebuild a denied one | `reconstructionAudit()` flags any denied node whose lineage is fully covered by the union of the returned set's lineage. Under strict enforcement it is provably `safe`; it fires the moment a pipeline over-shares. |
| **Stale reads under concurrent ACL updates** | No permission is cached on a derivative; each read recomputes from live source state in one synchronous pass. There is no read-modify-write window. Demonstrated under interleaved mutation load. |
| **Premature disclosure** — reading time-embargoed material early | Temporal rules contribute ∅ until the unlock instant; enforced by the same intersection. |
| **Audit tampering** — editing the log after the fact | FNV-1a hash chain (`hash = fnv1a(prev + payload)`); any edit breaks every subsequent link. `verifyChain()` returns the exact broken sequence number. HCS anchoring adds an independent timestamp. |

## What this does NOT claim (scope boundaries)

Being explicit here is the point:

- **Content-level statistical inference is out of scope.** We defend two concrete
  inference channels — **metadata** (tombstoning denied results) and
  **lineage reconstruction** (`reconstructionAudit`). We do *not* claim to stop
  the semantic case: if a viewer is *legitimately* granted two low-sensitivity
  memories whose *contents*, correlated, let them *guess* at something more
  sensitive. That is an open research problem (differential privacy / query
  auditing over content), and conflating it with access control would be
  overclaiming. We flag it as future work, not a solved feature.
- **Write-time classification is only as good as the classifier.** If the
  classifier mislabels a confidential source as public, the gate will faithfully
  enforce the wrong label. Classification quality is a separate concern from
  enforcement correctness — which is exactly why we keep the LLM at write time
  and out of the read path.
- **FNV-1a is a non-cryptographic hash.** It is used here for fast,
  tamper-*evident* chaining suitable for a demo and for detecting accidental or
  casual edits. A production deployment should swap in SHA-256 (a one-line change
  in `src/audit.js`) and rely on HCS for external integrity. The chaining
  *structure* is the contribution; the hash primitive is pluggable.
- **This is not a network/transport security layer.** TLS, authn of the caller,
  and key management are assumed to be handled by the surrounding system.

## Why "deterministic" is the security property, not a performance note

The reason enforcement must be deterministic isn't speed (though it buys us a
~500,000× latency margin). It's *auditability*. A regulator can replay any
decision from the graph state and the clock and get a bit-identical answer, with
a rule string explaining it. You cannot do that with a system that asks a model
to adjudicate access — its answer isn't reproducible, isn't explainable, and
isn't defensible. Determinism is what makes the audit trail mean something.
