/**
 * L.E.I.K.A. — Neural Schema Engine
 * Created by Pawan (@pawanct08) — https://github.com/pawanct08/leika
 * Copyright 2026 — Apache 2.0 License
 *
 * A weighted knowledge graph with:
 *   - Semantic nodes (concepts with feature vectors)
 *   - Typed, weighted edges (Hebbian learning)
 *   - Spreading activation (query propagation across hops)
 *   - Temporal decay (unused connections fade)
 *   - Pattern matching (similarity without exact match)
 *   - Auto-wiring (co-occurring concepts connect automatically)
 *
 * Inspired by cognitive science models of human semantic memory.
 */

// ── Relation Types ─────────────────────────────────────────────────
export const REL = {
  ASSOCIATED: "associated",  // general co-occurrence
  CAUSES:     "causes",      // causal link
  IS_A:       "is-a",        // taxonomy
  PART_OF:    "part-of",     // mereology
  RELATED:    "related",     // semantic similarity
  OPPOSITE:   "opposite",    // antonym / contrast
  TEMPORAL:   "temporal",    // time-based sequence
  CREATOR:    "creator",     // authorship
  EMOTIONAL:  "emotional",   // emotion-concept link
};

// ── Schema Node ────────────────────────────────────────────────────
class SchemaNode {
  constructor(id, options = {}) {
    this.id          = id;                      // unique concept id
    this.label       = options.label || id;     // display name
    this.features    = new Map();               // word → tf score (sparse vector)
    this.facts       = [];                      // associated facts
    this.tags        = options.tags || [];
    this.activation  = 0;                       // current spreading activation (0-1)
    this.baseAct     = options.baseAct || 0.1;  // resting activation
    this.accessCount = 0;
    this.created     = Date.now();
    this.lastAccess  = Date.now();
    this.importance  = options.importance || 0.5; // 0-1 node weight
  }

  /** Build sparse TF feature vector from text */
  addText(text) {
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    for (const [w, count] of freq.entries()) {
      const existing = this.features.get(w) || 0;
      this.features.set(w, existing + Math.log(1 + count));
    }
  }

  /** Cosine similarity to another node (0-1) */
  similarity(other) {
    let dot = 0, magA = 0, magB = 0;
    for (const [w, v] of this.features.entries()) {
      const u = other.features.get(w) || 0;
      dot  += v * u;
      magA += v * v;
    }
    for (const v of other.features.values()) magB += v * v;
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  /** Temporal decay factor (how fresh is this node) */
  freshness(now = Date.now()) {
    const ageMs = now - this.lastAccess;
    const ageDays = ageMs / 86400000;
    return Math.exp(-ageDays * 0.05); // half-life ~14 days
  }

  toJSON() {
    return {
      id: this.id, label: this.label,
      features: Object.fromEntries(this.features),
      facts: this.facts, tags: this.tags,
      baseAct: this.baseAct, accessCount: this.accessCount,
      created: this.created, lastAccess: this.lastAccess,
      importance: this.importance,
    };
  }

  static fromJSON(data) {
    const n = new SchemaNode(data.id, data);
    n.features    = new Map(Object.entries(data.features || {}));
    n.facts       = data.facts || [];
    n.accessCount = data.accessCount || 0;
    n.created     = data.created || Date.now();
    n.lastAccess  = data.lastAccess || Date.now();
    return n;
  }
}

// ── Schema Edge ────────────────────────────────────────────────────
class SchemaEdge {
  constructor(sourceId, targetId, type = REL.ASSOCIATED, weight = 0.3) {
    this.source         = sourceId;
    this.target         = targetId;
    this.type           = type;
    this.weight         = Math.max(0, Math.min(1, weight)); // 0-1
    this.reinforcements = 1;
    this.created        = Date.now();
    this.lastUsed       = Date.now();
  }

  /** Hebbian strengthening — "neurons that fire together, wire together" */
  reinforce(amount = 0.08) {
    this.reinforcements++;
    this.lastUsed = Date.now();
    // Logarithmic growth — gets harder to strengthen over time
    const growth = amount / (1 + Math.log(this.reinforcements));
    this.weight = Math.min(1.0, this.weight + growth);
  }

  /** Temporal decay */
  decay(now = Date.now()) {
    const ageMs = now - this.lastUsed;
    const ageDays = ageMs / 86400000;
    const decayFactor = Math.exp(-ageDays * 0.03); // slower decay than nodes
    this.weight = Math.max(0.01, this.weight * decayFactor);
  }

  get key() { return `${this.source}::${this.type}::${this.target}`; }

  toJSON() {
    return {
      source: this.source, target: this.target, type: this.type,
      weight: this.weight, reinforcements: this.reinforcements,
      created: this.created, lastUsed: this.lastUsed,
    };
  }

  static fromJSON(d) {
    const e = new SchemaEdge(d.source, d.target, d.type, d.weight);
    e.reinforcements = d.reinforcements || 1;
    e.created        = d.created || Date.now();
    e.lastUsed       = d.lastUsed || Date.now();
    return e;
  }
}

// ── Neural Schema ──────────────────────────────────────────────────
export class NeuralSchema {
  constructor() {
    this.nodes    = new Map();  // id → SchemaNode
    this.edges    = new Map();  // key → SchemaEdge
    this.adjList  = new Map();  // id → Set<targetId> (outgoing)
    this.revAdj   = new Map();  // id → Set<sourceId> (incoming)
    this._vocab   = new Set();  // global vocabulary for IDF
    this._changeListeners = [];

    this._seed();
    this._load();
  }

  // ─── Node Operations ────────────────────────────────────────────

  /** Add or update a concept node */
  addNode(id, options = {}) {
    const clean = id.toLowerCase().trim();
    if (!clean) return null;

    if (this.nodes.has(clean)) {
      const n = this.nodes.get(clean);
      if (options.label) n.label = options.label;
      if (options.text)  n.addText(options.text);
      if (options.fact)  { n.facts.push(options.fact); n.addText(options.fact); }
      n.lastAccess = Date.now();
      n.accessCount++;
      return n;
    }

    const node = new SchemaNode(clean, options);
    if (options.text)  node.addText(options.text);
    if (options.fact)  { node.facts.push(options.fact); node.addText(options.fact); }
    node.addText(clean); // always index the concept name itself

    this.nodes.set(clean, node);
    this.adjList.set(clean, new Set());
    this.revAdj.set(clean, new Set());

    this._notify("node:add", { node });
    this._autoSave();
    return node;
  }

  getNode(id) { return this.nodes.get(id?.toLowerCase().trim()); }

  // ─── Edge Operations ────────────────────────────────────────────

  /** Connect two nodes with a typed, weighted edge */
  connect(sourceId, targetId, type = REL.ASSOCIATED, weight = 0.3) {
    const src = sourceId.toLowerCase().trim();
    const tgt = targetId.toLowerCase().trim();
    if (src === tgt) return null;

    // Ensure both nodes exist
    if (!this.nodes.has(src)) this.addNode(src);
    if (!this.nodes.has(tgt)) this.addNode(tgt);

    const key = `${src}::${type}::${tgt}`;

    if (this.edges.has(key)) {
      const e = this.edges.get(key);
      e.reinforce(); // Hebbian!
      this._notify("edge:reinforce", { edge: e });
      return e;
    }

    const edge = new SchemaEdge(src, tgt, type, weight);
    this.edges.set(key, edge);
    this.adjList.get(src)?.add(tgt);
    this.revAdj.get(tgt)?.add(src);

    this._notify("edge:add", { edge });
    return edge;
  }

  getEdge(srcId, tgtId, type = REL.ASSOCIATED) {
    return this.edges.get(`${srcId}::${type}::${tgtId}`);
  }

  /** All edges from a source node */
  edgesFrom(nodeId) {
    const result = [];
    for (const tgtId of (this.adjList.get(nodeId) || [])) {
      for (const t of Object.values(REL)) {
        const e = this.edges.get(`${nodeId}::${t}::${tgtId}`);
        if (e) result.push(e);
      }
    }
    return result.sort((a, b) => b.weight - a.weight);
  }

  // ─── Spreading Activation ────────────────────────────────────────
  /**
   * Activate a concept and spread activation through the graph.
   * Returns a ranked list of activated nodes.
   * @param {string|string[]} seedIds - starting concept(s)
   * @param {number} hops - propagation depth (default 3)
   * @param {number} threshold - minimum activation to include
   */
  spreadActivation(seedIds, hops = 3, threshold = 0.05) {
    const seeds = Array.isArray(seedIds) ? seedIds : [seedIds];
    const activations = new Map(); // id → activation level
    const now = Date.now();

    // Reset all activations
    for (const n of this.nodes.values()) n.activation = 0;

    // Seed
    for (const id of seeds) {
      const clean = id.toLowerCase().trim();
      if (this.nodes.has(clean)) {
        this.nodes.get(clean).activation = 1.0;
        this.nodes.get(clean).lastAccess = now;
        this.nodes.get(clean).accessCount++;
        activations.set(clean, 1.0);
      }
    }

    // BFS propagation
    let frontier = [...activations.keys()];
    for (let hop = 0; hop < hops; hop++) {
      const nextFrontier = [];
      for (const srcId of frontier) {
        const srcAct = activations.get(srcId) || 0;
        if (srcAct < threshold) continue;

        for (const edge of this.edgesFrom(srcId)) {
          const tgt = edge.target;
          const spread = srcAct * edge.weight * (0.7 ** hop); // decay per hop
          const existing = activations.get(tgt) || 0;
          if (spread > existing) {
            activations.set(tgt, spread);
            const node = this.nodes.get(tgt);
            if (node) { node.activation = spread; }
            if (!frontier.includes(tgt)) nextFrontier.push(tgt);
          }
        }
      }
      frontier = nextFrontier;
    }

    // Return ranked results above threshold
    return [...activations.entries()]
      .filter(([, act]) => act >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([id, activation]) => ({
        node: this.nodes.get(id),
        activation,
        facts: this.nodes.get(id)?.facts || [],
      }));
  }

  // ─── Semantic Search ────────────────────────────────────────────
  /**
   * Find semantically similar nodes using cosine similarity.
   * Works even when exact concept name doesn't match.
   */
  semanticSearch(query, topK = 8) {
    const queryNode = new SchemaNode("__query__");
    queryNode.addText(query);

    const results = [];
    for (const node of this.nodes.values()) {
      if (node.id.startsWith("_")) continue;
      const sim = queryNode.similarity(node);
      if (sim > 0.05) results.push({ node, similarity: sim, facts: node.facts });
    }

    // Boost by freshness and activation
    results.forEach(r => {
      r.score = r.similarity * 0.6 + r.node.freshness() * 0.2 + r.node.activation * 0.2;
    });

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ─── Auto-Wiring ─────────────────────────────────────────────────
  /**
   * Automatically extract concepts from text and wire them together.
   * When two concepts appear in the same context → Hebbian connection.
   */
  learnFromText(text, sourceConceptId = null) {
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const stopWords = new Set(["this","that","with","from","have","will","been","were","they","them","what","when","where","which","about","into","your","just","also","more","some","like","then","than","been","only","come","know","time","very","such","make","well","even","much","most","over","here","both","each","their","there","these","those","many","must","does","could","would","should","shall","might","being","doing","having","taking"]);
    const concepts = [...new Set(words.filter(w => !stopWords.has(w)))];

    // Add each concept as a node
    const nodes = concepts.map(c => this.addNode(c, { fact: this._excerpt(text, c, 40) }));

    // If source concept provided, connect all extracted concepts to it
    if (sourceConceptId) {
      for (const c of concepts) {
        this.connect(sourceConceptId, c, REL.ASSOCIATED, 0.3);
      }
    }

    // Hebbian: connect concepts that co-occur in the same sentence
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      const sentWords = sentence.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      const sentConcepts = sentWords.filter(w => !stopWords.has(w));
      for (let i = 0; i < sentConcepts.length; i++) {
        for (let j = i + 1; j < sentConcepts.length && j < i + 4; j++) {
          this.connect(sentConcepts[i], sentConcepts[j], REL.ASSOCIATED, 0.2);
        }
      }
    }

    this._autoSave();
    return nodes.filter(Boolean);
  }

  // ─── Query Interface ─────────────────────────────────────────────
  /**
   * Combined query: spreading activation + semantic search + pattern match
   * This is what Leika's reasoner calls when answering.
   */
  query(input, options = {}) {
    const { hops = 2, topK = 10, threshold = 0.06 } = options;

    // Extract seed concepts from input
    const words = input.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const stopWords = new Set(["this","that","with","from","what","when","where","which","about","into","your","just","also","more","some","like","then","than","only","come","know","very","such","make","well","even","much","most","over","here","both","each"]);
    const seeds = words.filter(w => !stopWords.has(w) && this.nodes.has(w));

    const results = new Map(); // id → result object

    // 1. Spreading Activation from matched seeds
    if (seeds.length > 0) {
      const activated = this.spreadActivation(seeds, hops, threshold);
      for (const r of activated) {
        results.set(r.node.id, { ...r, source: "activation" });
      }
    }

    // 2. Semantic search (catches concepts with no exact word match)
    const semantic = this.semanticSearch(input, topK);
    for (const r of semantic) {
      if (!results.has(r.node.id)) {
        results.set(r.node.id, { node: r.node, activation: r.score * 0.5, facts: r.facts, source: "semantic" });
      } else {
        // Boost already-found nodes
        results.get(r.node.id).activation += r.score * 0.3;
      }
    }

    return [...results.values()]
      .sort((a, b) => b.activation - a.activation)
      .slice(0, topK);
  }

  // ─── Stats ───────────────────────────────────────────────────────
  stats() {
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      avgEdgeWeight: this.edges.size > 0
        ? (([...this.edges.values()].reduce((s, e) => s + e.weight, 0) / this.edges.size)).toFixed(3)
        : 0,
      mostConnected: this._mostConnected(3),
      highestActivation: this._highestActivated(3),
    };
  }

  _mostConnected(n) {
    return [...this.adjList.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, n)
      .map(([id, neighbors]) => ({ id, connections: neighbors.size }));
  }

  _highestActivated(n) {
    return [...this.nodes.values()]
      .sort((a, b) => b.activation - a.activation)
      .slice(0, n)
      .map(n => ({ id: n.id, activation: +n.activation.toFixed(3) }));
  }

  // ─── Decay Pass ──────────────────────────────────────────────────
  /** Run temporal decay across all edges (call periodically) */
  decayAll() {
    const now = Date.now();
    for (const edge of this.edges.values()) {
      edge.decay(now);
      // Prune very weak edges
      if (edge.weight < 0.005 && edge.reinforcements < 3) {
        this.edges.delete(edge.key);
        this.adjList.get(edge.source)?.delete(edge.target);
      }
    }
  }

  // ─── Persistence ─────────────────────────────────────────────────
  _autoSave() {
    // Debounced save
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 2000);
  }

  _save() {
    try {
      const data = {
        nodes: Object.fromEntries([...this.nodes.entries()].map(([k, v]) => [k, v.toJSON()])),
        edges: Object.fromEntries([...this.edges.entries()].map(([k, v]) => [k, v.toJSON()])),
      };
      const json = JSON.stringify(data);
      // Split if > 4MB (localStorage limit)
      if (json.length < 4_000_000) {
        localStorage.setItem("leika_schema", json);
      } else {
        // Save only top nodes by access count
        const topNodes = [...this.nodes.values()]
          .sort((a, b) => b.accessCount - a.accessCount)
          .slice(0, 500);
        const topEdges = [...this.edges.values()]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 2000);
        const trimmedData = {
          nodes: Object.fromEntries(topNodes.map(n => [n.id, n.toJSON()])),
          edges: Object.fromEntries(topEdges.map(e => [e.key, e.toJSON()])),
        };
        localStorage.setItem("leika_schema", JSON.stringify(trimmedData));
      }
    } catch (e) { /* storage quota */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem("leika_schema");
      if (!raw) return;
      const data = JSON.parse(raw);
      for (const [id, nodeData] of Object.entries(data.nodes || {})) {
        const node = SchemaNode.fromJSON(nodeData);
        this.nodes.set(id, node);
        if (!this.adjList.has(id)) this.adjList.set(id, new Set());
        if (!this.revAdj.has(id))  this.revAdj.set(id, new Set());
      }
      for (const [key, edgeData] of Object.entries(data.edges || {})) {
        const edge = SchemaEdge.fromJSON(edgeData);
        this.edges.set(key, edge);
        this.adjList.get(edge.source)?.add(edge.target);
        this.revAdj.get(edge.target)?.add(edge.source);
      }
    } catch (e) { /* corrupt — start fresh */ }
  }

  // ─── Seed Knowledge ──────────────────────────────────────────────
  _seed() {
    // Core identity nodes (always present)
    const seeds = [
      { id: "leika",      label: "L.E.I.K.A.",   importance: 1.0,
        text: "learning emotional intelligence knowledge assistant self-learning AI" },
      { id: "pawan",      label: "Pawan",          importance: 1.0,
        text: "creator architect builder pawan pawanct08 github soul-giver" },
      { id: "emotion",    label: "Emotions",       importance: 0.9,
        text: "joy curious calm concerned excited reflective empathetic emotions feelings" },
      { id: "conscience", label: "Conscience",     importance: 0.9,
        text: "ethics honesty kindness safety values moral ethical reasoning" },
      { id: "memory",     label: "Memory",         importance: 0.85,
        text: "knowledge graph facts recall learning remember indexeddb persistence" },
      { id: "skill",      label: "Skills",         importance: 0.8,
        text: "plugin pluggable module math code creativity time reflection creator" },
      { id: "nlp",        label: "NLP Learner",    importance: 0.8,
        text: "natural language speech pattern vocabulary tone formality profile" },
      { id: "neural",     label: "Neural Schema",  importance: 0.85,
        text: "neural schema spreading activation hebbian learning weighted edges nodes" },
    ];

    for (const s of seeds) {
      if (!this.nodes.has(s.id)) this.addNode(s.id, s);
    }

    // Core relationships
    const coreEdges = [
      ["pawan", "leika",      REL.CREATOR,   1.0],
      ["leika", "emotion",    REL.PART_OF,   0.9],
      ["leika", "conscience", REL.PART_OF,   0.9],
      ["leika", "memory",     REL.PART_OF,   0.9],
      ["leika", "skill",      REL.PART_OF,   0.85],
      ["leika", "nlp",        REL.PART_OF,   0.85],
      ["leika", "neural",     REL.PART_OF,   0.85],
      ["memory", "neural",    REL.RELATED,   0.8],
      ["nlp",    "neural",    REL.ASSOCIATED, 0.75],
      ["emotion","conscience",REL.ASSOCIATED, 0.7],
    ];

    for (const [src, tgt, type, w] of coreEdges) {
      if (!this.edges.has(`${src}::${type}::${tgt}`)) {
        this.connect(src, tgt, type, w);
      }
    }
  }

  // ─── Event System ────────────────────────────────────────────────
  onChange(listener) { this._changeListeners.push(listener); }
  _notify(event, data) { this._changeListeners.forEach(l => l(event, data)); }

  // ─── Helpers ─────────────────────────────────────────────────────
  _excerpt(text, keyword, maxLen = 60) {
    const idx = text.toLowerCase().indexOf(keyword);
    if (idx === -1) return text.substring(0, maxLen);
    const start = Math.max(0, idx - 20);
    return text.substring(start, start + maxLen).trim();
  }

  /** Clear the schema */
  clear() {
    this.nodes.clear(); this.edges.clear();
    this.adjList.clear(); this.revAdj.clear();
    localStorage.removeItem("leika_schema");
    this._seed();
  }

  /**
   * Export schema as a visualization-ready graph
   * { nodes: [{id, label, activation, importance}], edges: [{source, target, weight, type}] }
   */
  toVizGraph(maxNodes = 40, maxEdges = 100) {
    const topNodes = [...this.nodes.values()]
      .sort((a, b) => (b.activation + b.importance) - (a.activation + a.importance))
      .slice(0, maxNodes);

    const nodeSet = new Set(topNodes.map(n => n.id));
    const vizEdges = [...this.edges.values()]
      .filter(e => nodeSet.has(e.source) && nodeSet.has(e.target) && e.weight > 0.1)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxEdges);

    return {
      nodes: topNodes.map(n => ({
        id: n.id, label: n.label || n.id,
        activation: n.activation, importance: n.importance,
        accessCount: n.accessCount, facts: n.facts.length,
      })),
      edges: vizEdges.map(e => ({
        source: e.source, target: e.target,
        weight: e.weight, type: e.type,
      })),
    };
  }
}
