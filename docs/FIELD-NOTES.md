# Field notes

The non-obvious things I learned building this. Written for the next person (or
the next me) who has to reason about permissioned agent memory.

### 1. The wall isn't cryptography — it's authorization

Every "AI memory security" conversation drifts toward encryption. But the
failure mode in practice isn't that someone reads bytes they shouldn't — it's
that the system *cheerfully hands them a summary* of something they were never
cleared for. The hard part was never hiding data. It was deciding, correctly and
fast, **who is allowed to remember what** — and proving it afterwards.

### 2. If a model decides access, you don't have access control

The tempting shortcut is to let the LLM judge visibility ("here's the user's
role, here are the docs, only use what they're allowed to see"). That is not
access control — it's a *suggestion* the model usually follows. It can't be
audited (not reproducible), it can't be defended to a regulator (no rule), and
it folds under prompt injection. The whole architecture fell out of one rule:
**the model may run at write time; the read path is pure computation.** Once I
committed to that, everything got simpler.

### 3. Store lineage, not permissions

My first instinct was to *stamp* each derived memory with an ACL at creation
time (copy the parents' permissions down). It works until a permission changes —
then you're hunting every derivative to invalidate stale copies, and you will
miss one. The fix was to store **only lineage** and recompute the audience on
every read. Revocation stopped being a cache-invalidation problem and became…
nothing. There's no cache. Set `revoked = true` and the next read is already
correct. That's the "onion loop": you peel back to the source every time.

### 4. Intersection, not union

Getting the algebra right took a beat. A summary of a `{board}` deck and a
`public` blog must require `{board}` — the **intersection** of what its sources
demand, applied per-source. Union would leak (anyone who could read *either*
parent could read the child); a single global intersection over group-sets is
too blunt once you have more than two groups (`{board}` ∩ `{engineering}` = ∅
would wrongly hide a memory from someone who is in *both*). The correct model is
per-source: *you may read the child iff, for every source, you may read that
source.* That distinction is the difference between a demo and a bug.

### 5. Denying access can still leak — through the denial

The subtle one. Even with enforcement perfect, showing Carol a greyed-out card
that says *"MEM-04 · Leadership Call — Strategy · requires {board}"* has already
told her a confidential board strategy call exists. The *metadata* is the leak.
So denied nodes had to leave the retrieval layer as opaque tombstones —
`{id, visible:false}`, nothing else — and I wrote a self-audit (`auditLeaks`)
that fails if any returned field references a source the viewer can't read. It's
also where I learned to state the scope honestly: this stops the metadata
channel, not statistical inference over content. Claiming the latter would be a
lie a judge would catch.

### 6. Deterministic isn't a perf win, it's the product

The benchmark shows P99 in the sub-microsecond range — ~500,000× under the 200ms
budget. Nice, but not the point. The point is that determinism is what makes the
audit trail *mean* something: a regulator can replay any decision from the graph
+ clock and get the identical answer with a human-readable rule. Speed is a
side effect of doing the honest thing.

### 7. One engine, four consumers

The best decision was refusing to have two implementations. The browser console,
the Node API, the tests and the benchmark all import the same `src/` modules
(native ES modules, zero build step). When a test passes, the thing on screen is
the thing that passed. No "the demo does it differently."

---

*If you only take one thing: keep the LLM on the write path, make the read path
deterministic, and store lineage instead of permissions. The rest is bookkeeping.*
