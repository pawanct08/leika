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
    this.db = null;
    this.maxShortTerm = 20;
    this._initDB();
  }

  async _initDB() {
    return new Promise((resolve) => {
      const req = indexedDB.open("leika_memory", 2);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("facts"))
          db.createObjectStore("facts", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("conversations"))
          db.createObjectStore("conversations", { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains("skills"))
          db.createObjectStore("skills", { keyPath: "id" });
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

    // Persist to IndexedDB
    if (this.db) {
      const tx = this.db.transaction("facts", "readwrite");
      tx.objectStore("facts").add(entry);
    }

    return entry;
  }

  /** Retrieve facts about a concept */
  recall(concept) {
    const node = this.graph.get(concept?.toLowerCase());
    if (!node) return [];
    return node.facts.sort((a, b) => b.confidence - a.confidence);
  }

  /** Semantic-style search across all knowledge */
  search(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const results = [];

    for (const [concept, node] of this.graph.entries()) {
      for (const fact of node.facts) {
        const text = (concept + " " + fact.content).toLowerCase();
        const score = terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
        if (score > 0) results.push({ ...fact, concept, score });
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

  /** Load stored facts back into graph on startup */
  async _loadGraph() {
    if (!this.db) return;
    const tx = this.db.transaction("facts", "readonly");
    const req = tx.objectStore("facts").getAll();
    req.onsuccess = (e) => {
      for (const fact of e.target.result) {
        const concept = fact.concept || "general";
        if (!this.graph.has(concept)) this.graph.set(concept, { facts: [], relations: new Set() });
        this.graph.get(concept).facts.push(fact);
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
    this.shortTerm = [];
    if (this.db) {
      ["facts", "conversations"].forEach(store => {
        const tx = this.db.transaction(store, "readwrite");
        tx.objectStore(store).clear();
      });
    }
  }
}
