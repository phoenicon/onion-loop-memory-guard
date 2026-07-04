# DoraHacks submission — copy/paste ready

**Challenge:** BasedAI · Permission-Aware Memory Challenge (UK AI Agent Hackathon Ep5 × Conduct)

---

## Project name
Onion Loop Memory Guard

## Tagline (one line)
Permission-aware memory for AI agents — deterministic access, governed by lineage, proven by audit.

## Links
- **Live demo (no install):** https://phoenicon.github.io/onion-loop-memory-guard/web/library.html
- **Technical console:** https://phoenicon.github.io/onion-loop-memory-guard/web/index.html
- **60s reel:** https://phoenicon.github.io/onion-loop-memory-guard/web/reel.html
- **Source:** https://github.com/phoenicon/onion-loop-memory-guard
- **Live API (Render):** _[paste your onion-loop-memory-guard.onrender.com URL]_
- **Video:** _[paste your video link]_

## Tags
`ai-agents` `access-control` `rebac` `lineage` `audit-log` `hedera` `retrieval` `memory` `governance`

## Cover image
`docs/screenshots/onion-loop-poster.png` (in the repo)

---

## Description (paste into the BUIDL body)

**AI agents remember everything your company owns — but their memory has no permissions.**

Today's agent memory (RAG) retrieves by *relevance* and bolts permissions on in the application layer. So an AI summary of a confidential board deck happily answers a contractor's question, embeddings rank restricted knowledge into top-k results, revoked access leaves ghost copies in summaries and vectors, and there's no audit a regulator would accept.

**Onion Loop Memory Guard is the safety layer agents need before an enterprise can trust them.** Access is *computed from the source graph at read time* — never copied onto a derivative, and **never decided by an LLM**. Revoke a source and every summary, embedding and note derived from it recomputes to "no access" in the same read.

### How it works
Two paths. Only the **write path** may touch an LLM — once, to classify a source's ACL. The **read path** is pure computation:
1. **Resolve lineage** — walk each memory back to its leaf sources.
2. **Intersect ACLs** (clock-aware) — you may read a memory *iff* you may read every source behind it. Revoked or time-locked → ∅.
3. **Filter, then rank** — relevance is applied only over the granted set, never before.
4. **Hash-chained audit** — every decision + its rule is written to a tamper-evident ledger, anchored to Hedera Consensus Service.

### What makes it different
The permission lives on the **sources**, never on the AI's derivatives. To read a derivative you must be cleared for every source in its lineage — so revocation is *free* (nothing to invalidate, no cache to hunt), and a summary of a board deck can never outlive the deck's access. This deletes the **TOCTOU** (time-of-check-to-time-of-use) staleness class that plagues cache-based RAG permissioning.

### Proof, not promises (all reproducible)
- **0 LLM calls** on the decision path — pure, reproducible set logic
- **P99 ≈ 0.38µs** permission check — ~500,000× under the 200ms budget
- **12,000+ concurrent reads** vs live revoke/restore/clock — zero stale grants
- **39 invariant tests, 0 dependencies** — runs on the Node standard library
- Gate runs in front of a **real embedding + cosine search**: semantic search ranks a confidential deck #1 for a budget query; the gate drops it for a contractor and keeps it for a board member (`npm run vector`)

### Challenge requirements — covered
- ✅ Stays in sync with source ACLs under concurrent updates (no cached permissions)
- ✅ Retrieval-layer enforcement, no LLM in the decision path
- ✅ Regulator-grade, hash-chained, tamper-evident audit
- ✅ Sub-200ms P99 permission checks
- ✅ Lineage-governed derived memory + revocation propagation
- ✅ **Bonus:** temporal access rules ("unlock after 30 days")
- ✅ **Bonus:** query-time inference prevention (metadata tombstoning + cross-document reconstruction auditor)

### Verify in 60 seconds
```
git clone https://github.com/phoenicon/onion-loop-memory-guard
cd onion-loop-memory-guard
node --test            # 39 tests, 0 deps
node bench/p99.js      # sub-200ms P99
npm run vector         # the gate in front of a real vector search
npm run demo           # console + API at localhost:4173
```

Not a chatbot. Not a wrapper. **A deterministic governance layer for agent memory.** *Verify me — don't trust me.*
