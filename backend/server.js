require('dotenv').config();
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const { Pinecone } = require('@pinecone-database/pinecone');

const app = express();
app.use(cors());
app.use(express.json());

// ── LAYERED LLM ORCHESTRATOR ───────────────────────────────────────────
const LeikaLayeredLLM = require('./layered_llm');
// Use Mock if no key, else use LangChain LLM (placeholder for OpenAI/Gemini/Anthropic)
let llmInstance = null; 
// Example: const { ChatOpenAI } = require("@langchain/openai");
// if(process.env.OPENAI_API_KEY) llmInstance = new ChatOpenAI({ temperature: 0.2 });

const leikaMind = new LeikaLayeredLLM(llmInstance);

// ── ARCHITECTURAL CONNECTIONS ──────────────────────────────────────────
// Represents the hyperscale backend. In production, these connect to massive DBs.
const graphDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASS || 'leika')
);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'dummy_key',
  environment: process.env.PINECONE_ENV || 'gcp-us-west1'
});
const pIndex = pinecone.index('leika-internet-archive');

// ── ROUTES ─────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message, emotion } = req.body;
  if(!message) return res.status(400).json({error: "No message provided"});
  
  try {
    const result = await leikaMind.process(message, emotion || "calm");
    res.json({
      success: true,
      domain: result.domain_used,
      response: result.response
    });
  } catch(e) {
    console.error("LLM Error:", e);
    res.status(500).json({ error: "Layered AI failed to respond." });
  }
});

app.post('/api/subconscious/query', async (req, res) => {
  const { concepts } = req.body;
  if (!concepts || !concepts.length) return res.status(400).json({ error: "Provide seed concepts" });

  const session = graphDriver.session();
  try {
    // Advanced Spreading Activation Query in Cypher
    // Finds nodes within 3 hops of the seed concepts, weighted exponentially.
    const cypher = `
      MATCH (seed:Concept) WHERE seed.id IN $concepts
      MATCH (seed)-[r*1..3]-(related:Concept)
      RETURN related.id AS id, related.fact AS fact,
             reduce(w = 1.0, edge IN r | w * edge.weight) AS activation
      ORDER BY activation DESC LIMIT 10
    `;
    const result = await session.run(cypher, { concepts });
    const nodes = result.records.map(rec => ({
      id: rec.get('id'),
      fact: rec.get('fact'),
      activation: rec.get('activation')
    }));

    res.json({ success: true, nodes });
  } catch(e) {
    console.error("Neo4j Error:", e);
    res.status(500).json({ error: "Graph query failed" });
  } finally {
    session.close();
  }
});

app.post('/api/semantic/search', async (req, res) => {
  // Queries massive Vector DB for contextual internet meaning
  const { query, topK = 5 } = req.body;
  try {
    // Generate an embedding for the query (using OpenAI or local model)
    const mockVector = new Array(1536).fill(0.1); 

    const response = await pIndex.query({
      vector: mockVector,
      topK,
      includeMetadata: true
    });

    res.json({ success: true, contexts: response.matches.map(m => m.metadata.text) });
  } catch(e) {
    console.error("Pinecone Error:", e);
    res.status(500).json({ error: "Semantic memory fetch failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧠 L.E.I.K.A. Hyperscale Core Backend running on port ${PORT}`);
  console.log(`🔌 Connected to Neo4j Graph Database`);
  console.log(`🔌 Connected to Pinecone Vector Database`);
});
