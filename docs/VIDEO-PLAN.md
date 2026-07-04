# Video plan — two cuts, screen-record + Fable visuals

Two videos from the same material:
- **Trailer (60s)** — the hook. One undeniable win. For the top of the DoraHacks page + socials.
- **Deep-dive (2–3min)** — the proof. Walks the demo end-to-end. For judges who want to verify.

Everything you screen-record already exists and is live:
- Console → https://phoenicon.github.io/onion-loop-memory-guard/web/index.html
- Library → https://phoenicon.github.io/onion-loop-memory-guard/web/library.html
- Terminal → `npm run vector`, `node --test`, `node bench/p99.js`, `npm run demo`

> **Before recording:** open the console, click **Reset scenario**, and start as **Alice**. Clean state every take. Record at 1920×1080, 30fps. On Mac: `⌘⇧5` → Record Selected Portion.

---

## 🎬 VIDEO 1 — Trailer (60 seconds)

| # | Time | On screen (capture) | Voiceover (read this) |
|---|------|---------------------|------------------------|
| 1 | 0:00–0:06 | **Fable card** — the onion forming, title *Onion Loop Memory Guard* on near-black | *"Your AI agents remember everything your company owns."* |
| 2 | 0:06–0:15 | **Fable** — a document, a summary spawning from it, a red "confidential" tag slipping through | *"But their memory has no permissions. A summary of a confidential board deck will happily answer a contractor's question."* |
| 3 | 0:15–0:36 | **Console** — as Alice, hover the sources; then click **revoke** on SRC-01. Catch the REVOKED slam on MEM-01 & MEM-03. | *"Onion Loop fixes that. Watch — I revoke the source document. And every AI summary built from it vanishes. For everyone. Instantly. Because the permission was never copied onto the summary — it's recomputed, every single read."* |
| 4 | 0:36–0:48 | **Terminal** — `npm run vector`, highlight the two lines: secret ranks #1, then Carol → only the blog | *"Even semantic search can't leak it. Relevance ranks the confidential deck number one — the gate drops it anyway. No model makes that call. Pure computation. Sub-microsecond."* |
| 5 | 0:48–0:60 | **Fable outro** — tagline + live URL on screen | *"Onion Loop Memory Guard. Not a chatbot. Not a wrapper. A governance layer for agent memory. Verify me — don't trust me."* |

---

## 🎬 VIDEO 2 — Deep-dive (2–3 minutes)

**A. Cold open (0:00–0:15)** — *Fable title card + one-line problem*
> *"AI agents remember, summarise, and act across everything a company owns. But today's memory retrieves by relevance and bolts permissions on afterwards — so it leaks what the source protected. Here's the fix."*

**B. The idea, in a library (0:15–0:50)** — *screen: library.html + Fable "3D sneeze" cutaway*
> *"Think of a library. Public books anyone can read; a board-only shelf. An AI writes a summary from one of each. Who can read the summary? Only someone cleared for every book behind it. Nobody wrote a rule on the summary — the system traced it back to its sources."*
> Record: switch **Carol** (summary → restricted), then **Shred the Board deck** (it tips over; summary dies for everyone).

**C. The console — real enforcement (0:50–1:50)** — *screen: index.html*
> *"Same engine, the real console. Four people, four clearances."*
> - Switch **Bob** (Eng) → the board summary is hidden. Switch **Dana** (Board+Eng) → *"she's the only one who can read the note that needs board AND engineering."*
> - **Revoke SRC-01** → *"revoke the source, and every derivative recomputes to nothing — instantly, no cache to hunt."*
> - **Advance +30 days** → *"a leadership call embargoed for 30 days unlocks under normal rules. Same engine, a time axis."*
> - Point at the **audit ledger** → *"every decision is hash-chained. Edit one line and the whole chain breaks. It anchors to Hedera for an independent timestamp."*

**D. Not a toy — a real vector system (1:50–2:20)** — *terminal: `npm run vector`*
> *"This isn't a database gate. I embed a real corpus, run a genuine nearest-neighbour search, then run the same engine over the hits. Ask 'what's our Q3 budget?' — semantic search ranks the confidential board deck number one. The gate drops it for a contractor and keeps it for a board member. Similarity is not permission."*

**E. Proof (2:20–2:40)** — *terminal: `node --test` then `node bench/p99.js`*
> *"Every claim is tested and reproducible. Thirty-nine invariant tests, zero dependencies. Twelve thousand concurrent reads against live revocation — zero stale grants. P99 permission check: nought-point-three-eight microseconds. Half a million times under the budget."*

**F. Close (2:40–3:00)** — *Fable outro + verticals*
> *"Finance, health, government, real-world assets — the memory layer is where trust breaks, and this is the layer that fixes it. Not a chatbot. Not a wrapper. A deterministic governance layer for agent memory. It's live, it's open source, and every claim is one command away. Verify me — don't trust me."*

---

## 📋 Raw clips to capture (batch these, then assemble)

1. **Console — revoke** : as Alice, revoke SRC-01, catch the REVOKED slam. *(trailer #3 + deep-dive C)*
2. **Console — personas** : click Bob, then Dana; watch cards flip. *(deep-dive C)*
3. **Console — advance +30 days** : MEM-04 unlocks. *(deep-dive C)*
4. **Console — audit ledger** : slow pan of the hash-chained entries. *(deep-dive C)*
5. **Library — shred** : switch Carol, then Shred the Board deck (book tips over). *(deep-dive B + trailer)*
6. **Terminal — vector** : `npm run vector`, full output. *(both)*
7. **Terminal — proof** : `node --test` (tail) + `node bench/p99.js` (the PASS line). *(deep-dive E)*

## 🎨 Fable visuals to generate

- **Title card** — a glowing onion, concentric rings, "Onion Loop Memory Guard", near-black bg, one teal + one amber accent.
- **The 3D sneeze** — a cloud of small glowing points in space, mostly teal, one red point among them (a restricted embedding). *(deep-dive B, trailer #2)*
- **The lineage loop** — a source document, arrows down to a summary; then the source greys out and the summary dissolves. *(trailer #2/3)*
- **Section cards** — "The problem", "The demo", "The proof" — same motif, minimal.
- **Outro card** — tagline *"Verify me — don't trust me"* + the two live URLs.

## ⚠️ Note on stats
The voiceover deliberately uses **only verifiable claims** (the live demo + the real benchmark numbers). The "OWASP Top 10 / 88%" figures from slide 3 are **not** in the script until we've sourced them — don't ad-lib them on camera.
