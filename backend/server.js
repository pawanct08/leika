require('dotenv').config();
const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const { Pinecone } = require('@pinecone-database/pinecone');
const orchestrator = require('./orchestrator');
const { z } = require('zod');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── LLM CORE ──────────────────────────────────────────────────────────────
const LeikaLayeredLLM = require('./layered_llm');
const leikaMind = new LeikaLayeredLLM(null);
orchestrator.setLLM(leikaMind);

// ── OPTIONAL: OpenAI (embeddings + Whisper) ───────────────────────────────
let openai = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('[Leika] ✅ OpenAI wired');
  }
} catch (_) { console.warn('[Leika] ⚠️  openai package not installed — run: npm install openai'); }

// ── OPTIONAL: node-cron ──────────────────────────────────────────────────
let cron = null;
try { cron = require('node-cron'); } catch (_) {}

// ── OPTIONAL: systeminformation ──────────────────────────────────────────
let si = null;
try { si = require('systeminformation'); } catch (_) {}

// ── OPTIONAL: multer ─────────────────────────────────────────────────────
let upload = null;
try {
  const multer = require('multer');
  upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
} catch (_) { console.warn('[Leika] ⚠️  multer not installed — run: npm install multer'); }

// ── DATABASE CONNECTIONS ──────────────────────────────────────────────────
const graphDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASS || 'leika')
);

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY || 'dummy_key' });
const pIndex = pinecone.index('leika-internet-archive');

// ── SSE: Proactive Push Alerts ────────────────────────────────────────────
const sseClients = new Set();

function pushAlert(type, payload) {
  const data = JSON.stringify({ type, ...payload, ts: Date.now() });
  for (const res of sseClients) {
    try { res.write(`data: ${data}\n\n`); } catch (_) {}
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  sseClients.add(res);
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch (_) {} }, 25000);
  req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
});

// ── CRON: System monitoring + Weather alerts ──────────────────────────────
if (cron && si) {
  cron.schedule('* * * * *', async () => {
    try {
      const [cpuData, memData] = await Promise.all([si.currentLoad(), si.mem()]);
      const cpu = Math.round(cpuData.currentLoad);
      const ram = Math.round((memData.used / memData.total) * 100);
      if (cpu > 85 || ram > 90) {
        pushAlert('system_alert', { message: `⚠️ High usage: CPU ${cpu}% | RAM ${ram}%`, cpu, ram });
      }
    } catch (_) {}
  });

  cron.schedule('*/30 * * * *', async () => {
    try {
      const city = process.env.WEATHER_CITY || 'New Delhi';
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) return;
      const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
      const w = await r.json();
      if (w?.main) {
        const desc = w.weather?.[0]?.description || '';
        if (/storm|thunder|heavy rain|extreme/i.test(desc)) {
          pushAlert('weather_alert', { message: `⛈️ Weather alert for ${city}: ${desc}`, temp: w.main.temp });
        }
      }
    } catch (_) {}
  });
  console.log('[Leika] ✅ Cron monitoring active');
}

// ── ROUTES ────────────────────────────────────────────────────────────────

// Chat
app.post('/api/chat', async (req, res) => {
  const { message, emotion } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  if (message.startsWith('/')) {
    const [cmd, ...args] = message.slice(1).split(' ');
    if (cmd === 'swarm' || cmd === 'research') {
      const topic = args.join(' ') || 'general analysis';
      const result = await orchestrator.researchAndReport(topic);
      return res.json({ success: true, response: result, domain: 'swarm_orchestration' });
    }
    if (cmd === 'system') {
      if (si) {
        const [cpu, mem, disk] = await Promise.all([si.currentLoad(), si.mem(), si.fsSize()]);
        const info = { cpu: Math.round(cpu.currentLoad) + '%', ram: Math.round((mem.used / mem.total) * 100) + '%', disk: disk[0] ? Math.round((disk[0].used / disk[0].size) * 100) + '%' : 'N/A' };
        return res.json({ success: true, response: `🖥️ CPU ${info.cpu} | RAM ${info.ram} | Disk ${info.disk}`, domain: 'system' });
      }
      return res.json({ success: true, response: 'systeminformation not available', domain: 'system' });
    }
  }

  try {
    const result = await leikaMind.process(message, emotion || 'calm');
    res.json({ success: true, domain: result.domain_used, response: result.response });
  } catch (e) {
    console.error('LLM Error:', e);
    res.status(500).json({ error: 'Layered AI failed to respond.' });
  }
});

// Tools
app.post('/api/tools/call', async (req, res) => {
  const { name, params } = req.body;
  try {
    const result = await orchestrator.callTool(name, params);
    res.json({ success: true, result });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: e.errors });
    res.status(500).json({ error: e.message });
  }
});

// Subconscious / Neo4j graph
app.post('/api/subconscious/query', async (req, res) => {
  const { concepts } = req.body;
  if (!concepts || !concepts.length) return res.status(400).json({ error: 'Provide seed concepts' });
  const session = graphDriver.session();
  try {
    const cypher = `
      MATCH (seed:Concept) WHERE seed.id IN $concepts
      MATCH (seed)-[r*1..3]-(related:Concept)
      RETURN related.id AS id, related.fact AS fact,
             reduce(w = 1.0, edge IN r | w * edge.weight) AS activation
      ORDER BY activation DESC LIMIT 10
    `;
    const result = await session.run(cypher, { concepts });
    const nodes = result.records.map(rec => ({ id: rec.get('id'), fact: rec.get('fact'), activation: rec.get('activation') }));
    res.json({ success: true, nodes });
  } catch (e) {
    console.error('Neo4j Error:', e);
    res.status(500).json({ error: 'Graph query failed' });
  } finally { session.close(); }
});

// Semantic search / Pinecone (real embeddings when OpenAI available)
app.post('/api/semantic/search', async (req, res) => {
  const { query, topK = 5 } = req.body;
  try {
    let vector;
    if (openai) {
      const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
      vector = emb.data[0].embedding;
    } else {
      vector = new Array(1536).fill(0).map(() => Math.random() * 0.02);
    }
    const response = await pIndex.query({ vector, topK, includeMetadata: true });
    res.json({ success: true, contexts: response.matches.map(m => m.metadata?.text || '') });
  } catch (e) {
    console.error('Pinecone Error:', e);
    res.status(500).json({ error: 'Semantic memory fetch failed' });
  }
});

// System stats
app.get('/api/system', async (req, res) => {
  if (!si) return res.json({ cpu: 0, ram: 0, disk: 0, platform: process.platform });
  try {
    const [cpuData, memData, diskData, osData] = await Promise.all([si.currentLoad(), si.mem(), si.fsSize(), si.osInfo()]);
    res.json({
      cpu: Math.round(cpuData.currentLoad),
      ram: Math.round((memData.used / memData.total) * 100),
      disk: diskData[0] ? Math.round((diskData[0].used / diskData[0].size) * 100) : 0,
      platform: osData.platform,
      distro: osData.distro,
      hostname: osData.hostname
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Weather
app.get('/api/weather', async (req, res) => {
  const city = req.query.q || process.env.WEATHER_CITY || 'New Delhi';
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.json({ mock: true, temp: 28, description: 'Sunny', city });
  try {
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`);
    const data = await r.json();
    res.json({ temp: data.main?.temp, feels_like: data.main?.feels_like, humidity: data.main?.humidity, description: data.weather?.[0]?.description, city: data.name, country: data.sys?.country });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Voice transcription (Whisper)
app.post('/api/transcribe', (req, res) => {
  if (!upload) return res.status(503).json({ error: 'multer not installed — run: npm install multer' });
  upload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    if (!openai) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
    try {
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer);
      stream.path = 'audio.webm';
      const transcription = await openai.audio.transcriptions.create({ file: stream, model: 'whisper-1' });
      res.json({ success: true, text: transcription.text });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

// TTS (ElevenLabs stream, browser fallback)
app.post('/api/speak', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  if (!apiKey) return res.json({ use_browser_tts: true, text });
  try {
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8 } })
    });
    if (!r.ok) return res.json({ use_browser_tts: true, text });
    res.setHeader('Content-Type', 'audio/mpeg');
    r.body.pipe(res);
  } catch (_) { res.json({ use_browser_tts: true, text }); }
});

// Vision (Claude Vision API)
app.post('/api/vision', async (req, res) => {
  const { image, prompt = 'Describe this image in detail.', mimeType = 'image/jpeg' } = req.body;
  if (!image) return res.status(400).json({ error: 'No image data (base64 expected)' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  try {
    let Anthropic;
    try { Anthropic = require('@anthropic-ai/sdk'); } catch (_) { return res.status(503).json({ error: '@anthropic-ai/sdk not installed' }); }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: image } },
        { type: 'text', text: prompt }
      ]}]
    });
    res.json({ success: true, description: resp.content[0]?.text });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// User profile
app.get('/api/profile', (req, res) => {
  res.json({ success: true, profile: leikaMind.getUserProfile() });
});

app.post('/api/profile', (req, res) => {
  leikaMind.setUserProfile(req.body);
  res.json({ success: true, profile: leikaMind.getUserProfile() });
});

// Multi-agent research pipeline
app.post('/api/research', async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: 'No topic provided' });
  try {
    const result = await orchestrator.researchAndReport(topic);
    res.json({ success: true, report: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Document ingest (PDF, DOCX, TXT)
app.post('/api/ingest', (req, res) => {
  if (!upload) return res.status(503).json({ error: 'multer not installed' });
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      let text = '';
      const mime = req.file.mimetype;
      if (mime === 'application/pdf') {
        try { const pp = require('pdf-parse'); const p = await pp(req.file.buffer); text = p.text; } catch (_) { text = '[PDF parsing unavailable — npm install pdf-parse]'; }
      } else if (mime.includes('wordprocessingml')) {
        try { const m = require('mammoth'); const r = await m.extractRawText({ buffer: req.file.buffer }); text = r.value; } catch (_) { text = '[DOCX parsing unavailable — npm install mammoth]'; }
      } else {
        text = req.file.buffer.toString('utf-8');
      }
      const chunks = text.match(/.{1,1000}/gs) || [];
      res.json({ success: true, chunks: chunks.length, preview: text.slice(0, 200) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🧠 L.E.I.K.A. Hyperscale Core running on port ${PORT}`);
  console.log(`🔌 Neo4j: ${process.env.NEO4J_URI || 'bolt://localhost:7687'}`);
  console.log(`🔌 Pinecone vector database ready`);
  console.log(`📡 SSE proactive alerts: GET /api/events`);
  console.log(`🎤 Voice: POST /api/transcribe | 🔊 TTS: POST /api/speak`);
  console.log(`👁️  Vision: POST /api/vision | 🔬 Research: POST /api/research`);
});
