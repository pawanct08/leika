/**
 * L.E.I.K.A. — Continual Learning Loop
 *
 * Logs every chat exchange, scores it for quality, and maintains a growing
 * dataset of high-quality examples.  Call exportTrainingData() to produce a
 * LLaMA / Alpaca-compatible fine-tuning JSONL ready for llama.cpp or any
 * Hugging Face SFT toolkit.
 *
 * Storage layout (relative to project root):
 *   data/exchanges.jsonl     — raw exchange log (every entry)
 *   data/training_data.jsonl — filtered high-quality training set
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR      = path.resolve(__dirname, '..', 'data');
const EXCHANGE_FILE = path.join(DATA_DIR, 'exchanges.jsonl');
const TRAINING_FILE = path.join(DATA_DIR, 'training_data.jsonl');

/** Only exchanges scoring at or above this threshold enter the training set. */
const MIN_QUALITY_SCORE = 0.60;

// Ensure data directory exists on first require
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

// ── Scoring ───────────────────────────────────────────────────────────────

/**
 * scoreExchange(query, response) → number [0..1]
 *
 * Heuristic multi-dimensional quality scoring — no model required.
 * Dimensions: response length, reasoning signals, query relevance,
 * code/data presence, and subtracted penalties for hedging / mock output.
 */
function scoreExchange(query, response) {
  if (!response || response.length < 15) return 0;
  let score = 0;

  // Length score: 100–800 chars is ideal for most responses
  const len = response.length;
  if      (len >= 100 && len <= 800)  score += 0.30;
  else if (len >= 50  && len < 100)   score += 0.15;
  else if (len > 800  && len <= 2000) score += 0.20;
  else if (len > 2000)                score += 0.10;

  // Quality signals: code blocks, numbers, causal connectors
  if (/```/.test(response))                                                           score += 0.15;
  if (/\b\d+\.?\d*\b/.test(response))                                                score += 0.05;
  if (/\b(because|therefore|thus|since|as a result|consequently)\b/i.test(response)) score += 0.10;

  // Penalise hedge / refusal phrases
  const hedges = (response.match(
    /\b(i don'?t know|i'?m not sure|i cannot|i'?m unable|i can'?t help)\b/gi
  ) || []).length;
  score -= hedges * 0.20;

  // Penalise mock / offline responses (API key not configured)
  if (/\[mock response|offline mode|add anthropic_api_key/i.test(response)) score -= 0.60;

  // Query relevance: significant words from the query appearing in response
  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);

  if (queryWords.length > 0) {
    const hits = queryWords.filter(w => response.toLowerCase().includes(w)).length;
    score += Math.min(0.20, (hits / queryWords.length) * 0.20);
  }

  return Math.max(0, Math.min(1, score));
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * logExchange(query, response, domain, metadata)
 * Persists one chat exchange to the JSONL log with a computed quality score.
 * Non-blocking: file writes are synchronous but errors are swallowed so that
 * the learning loop never interrupts the user-facing chat path.
 *
 * @param {string} query
 * @param {string} response
 * @param {string} domain     — MoE domain used (e.g. 'programming')
 * @param {object} [metadata] — optional additional fields to store
 * @returns {{ id: string, score: number }}
 */
function logExchange(query, response, domain, metadata = {}) {
  const score  = scoreExchange(query, response);
  const record = {
    id:        require('crypto').randomUUID(),
    timestamp: new Date().toISOString(),
    domain,
    score,
    query:    query.slice(0, 2000),
    response: response.slice(0, 4000),
    ...metadata,
  };
  try {
    fs.appendFileSync(EXCHANGE_FILE, JSON.stringify(record) + '\n', 'utf-8');
  } catch (e) {
    console.warn('[LearningLoop] Could not write exchange log:', e.message);
  }
  return { id: record.id, score };
}

/**
 * getStats() — summary statistics of the exchange log.
 * @returns {{ total, qualityCount, avgScore, domainCounts }}
 */
function getStats() {
  try {
    const raw     = fs.readFileSync(EXCHANGE_FILE, 'utf-8').trim();
    const records = raw
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    const total        = records.length;
    const qualityCount = records.filter(r => r.score >= MIN_QUALITY_SCORE).length;
    const avgScore     = total
      ? records.reduce((s, r) => s + (r.score || 0), 0) / total
      : 0;
    const domainCounts = {};
    records.forEach(r => { domainCounts[r.domain] = (domainCounts[r.domain] || 0) + 1; });

    return { total, qualityCount, avgScore: +avgScore.toFixed(3), domainCounts };
  } catch {
    return { total: 0, qualityCount: 0, avgScore: 0, domainCounts: {} };
  }
}

/**
 * exportTrainingData() — writes high-quality exchanges to an Alpaca-format JSONL.
 *
 * Output format per line: { instruction, input, output, domain, quality_score }
 * Compatible with standard LLaMA / Mistral SFT toolchains (Axolotl, unsloth, etc.)
 *
 * @returns {{ exported: number, total: number, path: string }}
 */
function exportTrainingData() {
  try {
    const raw     = fs.readFileSync(EXCHANGE_FILE, 'utf-8').trim();
    const records = raw
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);

    const quality = records.filter(r => r.score >= MIN_QUALITY_SCORE);

    const trainingLines = quality.map(r => JSON.stringify({
      instruction:   r.query,
      input:         '',
      output:        r.response,
      domain:        r.domain,
      quality_score: r.score,
    }));

    fs.writeFileSync(TRAINING_FILE, trainingLines.join('\n') + '\n', 'utf-8');
    console.log(`[LearningLoop] ✅ Exported ${quality.length}/${records.length} high-quality exchanges`);
    return { exported: quality.length, total: records.length, path: TRAINING_FILE };
  } catch (e) {
    console.warn('[LearningLoop] Export failed:', e.message);
    return { exported: 0, total: 0, error: e.message };
  }
}

module.exports = { scoreExchange, logExchange, getStats, exportTrainingData, MIN_QUALITY_SCORE };
