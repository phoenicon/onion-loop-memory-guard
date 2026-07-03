// @ts-check
/**
 * vector.js — a real (small) retrieval stack: embed → store → nearest-dot search.
 *
 * This is the "3D sneeze": every text becomes a point in space, similar meanings
 * land near each other, and search means "grab the nearest points to my query."
 * It exists so the permission gate can stand in front of a REAL similarity
 * search, not a hand-drawn one.
 *
 * Embedder is pluggable and honest about what it is:
 *   • default  — a dependency-free, deterministic *lexical* embedding
 *                (feature-hashed word + char-3gram counts, L2-normalised).
 *                Real vectors, real cosine geometry; not a neural model.
 *   • OpenAI   — if process.env.OPENAI_API_KEY is set, uses
 *                text-embedding-3-small for production-grade semantic vectors.
 * Swap in Pinecone/pgvector by reimplementing VectorStore.search — nothing else
 * changes, because the gate runs AFTER search regardless of the store.
 */

const DIM = 256;

/** tokens: words + padded char-3grams, for fuzzy lexical overlap. */
function tokens(text) {
  const clean = String(text).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const grams = [];
  for (const w of words) {
    const s = '#' + w + '#';
    for (let i = 0; i + 3 <= s.length; i++) grams.push(s.slice(i, i + 3));
  }
  return words.concat(grams);
}

function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic local embedding. @param {string} text @returns {number[]} unit vector */
export function embedLocal(text, dim = DIM) {
  const v = new Array(dim).fill(0);
  for (const tok of tokens(text)) v[hash(tok) % dim] += 1;
  let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

async function embedOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

/** The active embedder's name, for honest labelling in output. */
export function embedderName() {
  return process.env.OPENAI_API_KEY ? 'openai:text-embedding-3-small' : `local:hashed-3gram-${DIM}d`;
}

/** Embed text into a vector. Async so OpenAI and local share one interface. @returns {Promise<number[]>} */
export async function embed(text) {
  return process.env.OPENAI_API_KEY ? embedOpenAI(text) : embedLocal(text);
}

/** Cosine similarity. Vectors need not be pre-normalised. */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** A tiny in-memory vector index. Swap for Pinecone/pgvector without touching the gate. */
export class VectorStore {
  constructor() { /** @type {{id:string, vec:number[], meta:any}[]} */ this.items = []; }
  add(id, vec, meta = {}) { this.items.push({ id, vec, meta }); return this; }
  /** Nearest-neighbour search by cosine. @returns {{id:string, score:number, meta:any}[]} */
  search(queryVec, k = 5) {
    return this.items
      .map((it) => ({ id: it.id, score: cosine(queryVec, it.vec), meta: it.meta }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}
