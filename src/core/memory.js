/**
 * L.E.I.K.A. — Memory & Knowledge Graph
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * Leika's memory system uses IndexedDB for persistent
 * storage and a simple in-memory graph for fast reasoning.
 */

export class MemorySystem {
  constructor() {
    this.shortTerm = [];      // Last N exchanges (working memory)
    this.graph = new Map();   // Knowledge graph: concept → { relations, facts }
    this.index = new Map();   // Inverted word → Set of concepts (fast search)
    this.db = null;
    this.maxShortTerm = 20;
    this._initDB();
  }

  async _initDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open("leika_memory", 3);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("facts"))
          db.createObjectStore("facts", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("conversations"))
          db.createObjectStore("conversations", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("skills"))
          db.createObjectStore("skills", { keyPath: "id" });
        // v3: concept index for fast range queries
        if (db.version >= 3) {
          const facts = e.target.transaction.objectStore("facts");
          if (!facts.indexNames.contains("concept"))
            facts.createIndex("concept", "concept", { unique: false });
        }
      };  
      req.onsuccess = (e) => {
        this.db = e.target.result;
        this._loadGraph();
        resolve();
      };
      req.onerror = () => resolve(); // Degrade gracefully
    });
  }

  /** Learn a new fact */
  async learn(fact) {
    const entry = {
      concept: fact.concept || "general",
      content: fact.content,
      confidence: fact.confidence ?? 0.8,
      source: fact.source || "conversation",
      timestamp: Date.now(),
      tags: fact.tags || [],
    };

    // Update in-memory graph
    if (!this.graph.has(entry.concept)) {
      this.graph.set(entry.concept, { facts: [], relations: new Set() });
    }
    this.graph.get(entry.concept).facts.push(entry);

    // Build inverted index for every word ≥ 3 chars
    this._indexFact(entry.concept, entry);

    // Persist to IndexedDB
    if (this.db) {
      const tx = this.db.transaction("facts", "readwrite");
      tx.objectStore("facts").add(entry);
    }

    return entry;
  }

  /** Internal: add all words in concept + content to inverted index */
  _indexFact(concept, entry) {
    const words = (concept + " " + entry.content)
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length >= 3);
    for (const word of words) {
      if (!this.index.has(word)) this.index.set(word, new Set());
      this.index.get(word).add(concept);
    }
  }

  /** Retrieve facts about a concept */
  recall(concept) {
    const node = this.graph.get(concept?.toLowerCase());
    if (!node) return [];
    return node.facts.sort((a, b) => b.confidence - a.confidence);
  }

  /** Fast inverted-index search across all knowledge */
  search(query) {
    const terms = query.toLowerCase().split(/\W+/).filter(t => t.length >= 3);
    if (terms.length === 0) return [];

    // Gather candidate concepts from the inverted index
    const candidateCounts = new Map();
    for (const term of terms) {
      // Exact match
      const exactHits = this.index.get(term);
      if (exactHits) {
        for (const concept of exactHits) {
          candidateCounts.set(concept, (candidateCounts.get(concept) || 0) + 2);
        }
      }
      // Prefix match (handles partial words)
      for (const [word, concepts] of this.index.entries()) {
        if (word !== term && word.startsWith(term.slice(0, 4))) {
          for (const concept of concepts) {
            candidateCounts.set(concept, (candidateCounts.get(concept) || 0) + 1);
          }
        }
      }
    }

    if (candidateCounts.size === 0) return [];

    // Score every fact belonging to candidate concepts
    const results = [];
    for (const [concept, baseScore] of candidateCounts.entries()) {
      const node = this.graph.get(concept);
      if (!node) continue;
      for (const fact of node.facts) {
        const text = (concept + " " + fact.content).toLowerCase();
        const termScore = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
        const score = (baseScore + termScore) * (fact.confidence || 0.5);
        results.push({ ...fact, concept, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  /** Add to short-term (working) memory */
  addToShortTerm(entry) {
    this.shortTerm.push({ ...entry, timestamp: Date.now() });
    if (this.shortTerm.length > this.maxShortTerm)
      this.shortTerm.shift();
  }

  /** Get recent conversation context */
  getContext(n = 5) {
    return this.shortTerm.slice(-n);
  }

  /** Get exact value by key */
  get(key) {
    const results = this.search(key);
    return results[0]?.content ?? null;
  }

  /** Set a named fact */
  async set(key, value) {
    return this.learn({ concept: key, content: value, confidence: 1.0 });
  }

  /** Save a conversation turn */
  async saveConversation(user, leika) {
    this.addToShortTerm({ role: "user", content: user });
    this.addToShortTerm({ role: "leika", content: leika });

    if (this.db) {
      const tx = this.db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").add({
        user, leika, timestamp: Date.now()
      });
    }
  }

  /** Load stored facts back into graph + rebuild inverted index on startup */
  async _loadGraph() {
    if (!this.db) return;
    const tx = this.db.transaction("facts", "readonly");
    const req = tx.objectStore("facts").getAll();
    req.onsuccess = (e) => {
      for (const fact of e.target.result) {
        const concept = fact.concept || "general";
        if (!this.graph.has(concept)) this.graph.set(concept, { facts: [], relations: new Set() });
        this.graph.get(concept).facts.push(fact);
        this._indexFact(concept, fact);
      }
    };
  }

  /** Stats about Leika's memory */
  stats() {
    let totalFacts = 0;
    for (const node of this.graph.values()) totalFacts += node.facts.length;
    return {
      concepts: this.graph.size,
      facts: totalFacts,
      shortTermUsed: this.shortTerm.length,
    };
  }

  /** Clear all memory */
  async clear() {
    this.graph.clear();
    this.index.clear();
    this.shortTerm = [];
    if (this.db) {
      ["facts", "conversations"].forEach(store => {
        const tx = this.db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
      });
    }
  }
}
