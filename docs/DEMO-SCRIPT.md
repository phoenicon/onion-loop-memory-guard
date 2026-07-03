# Demo script

A tight 2-minute run. The whole point is one **undeniable trust win** the judge
remembers: *revoke a source, and an AI-generated summary of it vanishes for
everyone, instantly, with an audit entry explaining why.*

## Setup (10 seconds)

```bash
npm run demo        # → http://localhost:4173   (or: make demo / docker compose up)
```

Open the console. You're "retrieving as **Alice** (Board)". Four ACL'd sources on
the left; four AI-derived memories (summaries, an embedding, a note) in the
middle; a live hash-chained audit ledger on the right.

## The 2-minute narration

**0:00 — The problem (10s).**
> "AI agents remember, summarise, and act across a company's tools. But who
> controls what they can recall? Today, permission checks live in the app layer,
> and summaries leak what the source protected. This is the safety layer agents
> need before an enterprise can trust them."

**0:15 — Inherited permission (25s).** Point at **MEM-01**, a summary of the Q3
board deck + a public blog.
> "This memory was *derived* from two sources. It carries no permissions of its
> own — only its lineage. Access is computed right now: it needs `{board}`,
> because one of its parents does. Watch."

Click **Bob (Engineering)**. MEM-01 and the board note go dark → *DENY*.
Click **Dana (Board+Eng)**. The infra↔board note (`requires board ∧ engineering`)
appears — she's the only persona in both groups.
> "No LLM decided that. It's the intersection of the sources, computed in
> microseconds."

**0:40 — The undeniable win: revocation propagation (30s).** Back to **Alice**.
Click **revoke access** on **SRC-01 (Q3 Board Deck)**.
> "I've revoked the *source*. I did nothing to the summary."

MEM-01 and MEM-03 slam a red **REVOKED** stamp and disappear — for everyone.
> "The derivatives inherited the revocation the instant it happened. There was
> no cache to clear. The summary of a board deck cannot outlive the board deck's
> permissions."

**1:10 — Temporal governance (20s).** Restore SRC-01. Point at **SRC-04**
(*Leadership Call, unlocks +30d*) — MEM-04 is ∅ for everyone, even Alice.
Click **Advance +30 days**.
> "Embargoed material — 'leadership notes unlock after 30 days.' Same engine, a
> time dimension. Advance the clock, and it unlocks under normal ACLs."

**1:30 — The audit trail (20s).** Point at the right column.
> "Every decision — grant or deny — is written to a hash-chained ledger with the
> rule that produced it and its latency. Tamper with any entry and the chain
> breaks at that exact line. Batches anchor to Hedera for an independent
> timestamp. This is the difference between 'trust me' and 'verify me'."

**1:50 — The frame (10s).**
> "Not a chatbot. Not a wrapper. A deterministic governance layer for agent
> memory: inherited permissions, revocation by lineage, temporal rules, and a
> provable audit trail. That's what makes autonomous agents safe to deploy in
> finance, health, government — and real-world assets."

## If you have 20 more seconds — the API

```bash
curl "http://localhost:4173/api/retrieve?as=carol" | jq '.decisions, .inferenceGuard.safe'
```
> "Same engine, server-side. Carol the contractor gets one public memory; the
> rest come back as opaque tombstones — she can't even tell a board strategy
> memory *exists*. `inferenceGuard.safe: true` proves the response leaks nothing."

## Reset

Click **Reset scenario** any time to return to the opening state.
