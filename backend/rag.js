/**
 * L.E.I.K.A. — RAG Pipeline (Retrieval-Augmented Generation)
 *
 * Embeds text with OpenAI, stores / retrieves from a Qdrant vector store.
 * Falls back to an in-memory cosine-similarity store when Qdrant is not
 * available.  The LLM caller receives formatContext(results) — a compact
 * context block ready to prepend to any system or user prompt.
 *
 * Env vars:
 *   QDRANT_URL         e.g. http://localhost:6333
 *   QDRANT_KEY         API key (optional for local Qdrant)
 *   QDRANT_COLLECTION  collection name override (default: leika_rag)
 *   OPENAI_API_KEY     enables real OpenAI embeddings
 */

const crypto = require('crypto');

const COLLECTION = process.env.QDRANT_COLLECTION || 'leika_rag';
const EMBED_DIM   = 1536;

// ── In-memory fallback vector store ──────────────────────────────────────
const memStore = [];

// ── Qdrant client (lazy-init, optional) ──────────────────────────────────
let _qdrant = null;

async function _getQdrant() {
  if (_qdrant !== null) return _qdrant;
  if (!process.env.QDRANT_URL) { _qdrant = false; return false; }
  try {
    const { QdrantClient } = require('@qdrant/js-client-rest');
    const client = new QdrantClient({
      url:    process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_KEY || undefined,
    });
    // Ensure collection exists, create if missing
    try {
      await client.getCollection(COLLECTION);
    } catch (_) {
      await client.createCollection(COLLECTION, {
        vectors: { size: EMBED_DIM, distance: 'Cosine' },
      });
      console.log(`[RAG] ✅ Created Qdrant collection: ${COLLECTION}`);
    }
    _qdrant = client;
    console.log('[RAG] ✅ Qdrant connected:', process.env.QDRANT_URL);
  } catch (e) {
    console.warn('[RAG] ⚠️  Qdrant unavailable — using in-memory fallback:', e.message);
    _qdrant = false;
  }
  return _qdrant;
}

// ── OpenAI embeddings (lazy-init, optional) ───────────────────────────────
let _openai = null;

function _getOpenAI() {
  if (_openai !== null) return _openai;
  if (!process.env.OPENAI_API_KEY) { _openai = false; return false; }
  try {
    const OpenAI = require('openai');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (_) { _openai = false; }
  return _openai;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * embed(text) → number[]  (1536-dim L2-normalised vector)
 *
 * Uses OpenAI text-embedding-3-small when available; otherwise generates a
 * deterministic hash-based mock vector that is consistent across calls and
 * can support approximate nearest-neighbour without an API key.
 */
async function embed(text) {
  const oai = _getOpenAI();
  if (oai) {
    try {
      const res = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8192),
      });
      return res.data[0].embedding;
    } catch (e) {
      console.warn('[RAG] Embedding API error — using mock:', e.message);
    }
  }
  // Deterministic mock: SHA-256 hash → seeded float sequence, L2-normalised
  const hash = crypto.createHash('sha256').update(text).digest();
  const vec  = [];
  for (let i = 0; i < EMBED_DIM; i++) {
    vec.push(((hash[i % 32] * 137 + i * 31) % 256) / 255 * 2 - 1);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * ingest(text, metadata) — embeds text and stores it in the vector store.
 * @param {string} text
 * @param {object} metadata  arbitrary key/value pairs stored alongside the vector
 * @returns {string}  UUID of the stored point
 */
async function ingest(text, metadata = {}) {
  const id  = crypto.randomUUID();
  const vec = await embed(text);
  const q   = await _getQdrant();

  if (q) {
    await q.upsert(COLLECTION, {
      wait: true,
      points: [{ id, vector: vec, payload: { text: text.slice(0, 2000), ...metadata } }],
    });
  } else {
    memStore.push({ id, vector: vec, payload: { text: text.slice(0, 2000), ...metadata } });
  }
  return id;
}

/**
 * search(query, topK=5) — returns the top-k most relevant stored chunks.
 * @param {string} query
 * @param {number} topK   maximum number of results to return
 * @returns {Array<{ text: string, score: number, metadata: object }>}
 */
async function search(query, topK = 5) {
  const queryVec = await embed(query);
  const q        = await _getQdrant();

  if (q) {
    try {
      const result = await q.search(COLLECTION, {
        vector:       queryVec,
        limit:        topK,
        with_payload: true,
      });
      return result.map(r => ({
        text:     r.payload?.text || '',
        score:    r.score,
        metadata: r.payload || {},
      }));
    } catch (e) {
      console.warn('[RAG] Qdrant search error:', e.message);
    }
  }

  // In-memory cosine search fallback
  if (memStore.length === 0) return [];
  return memStore
    .map(doc => ({
      text:     doc.payload.text,
      score:    _cosineSim(queryVec, doc.vector),
      metadata: doc.payload,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * formatContext(results) — formats retrieved chunks for LLM context injection.
 * Returns an empty string if nothing scored above the relevance threshold,
 * so callers can safely append it to any prompt without breaking formatting.
 */
function formatContext(results) {
  if (!results || results.length === 0) return '';
  const chunks = results
    .filter(r => r.score > 0.30)
    .map((r, i) => `[${i + 1}] (relevance ${r.score.toFixed(2)}) ${r.text}`);
  if (chunks.length === 0) return '';
  return `\n\n--- Relevant Knowledge (retrieved from memory) ---\n${chunks.join('\n\n')}\n---\n`;
}

module.exports = { embed, ingest, search, formatContext };
