/**
 * L.E.I.K.A. — Main UI Controller
 * Copyright 2026 — Apache 2.0 License
 *
 * Wires the LEIKA engine to the DOM.
 */

import { LEIKA } from "../core/leika.js";
import { EMOTIONS } from "../core/emotion.js";
import { NeuralViz } from "./neural-viz.js";

// ─── Boot ────────────────────────────────────────────────────────
const leika = new LEIKA();
const viz = new NeuralViz("neural-canvas");

// Load built-in skills
(async () => {
  await leika.addSkill((await import("../../skills/math.js")).default);
  await leika.addSkill((await import("../../skills/time-date.js")).default);
  await leika.addSkill((await import("../../skills/self-reflection.js")).default);
  await leika.addSkill((await import("../../skills/code-helper.js")).default);
  await leika.addSkill((await import("../../skills/creativity.js")).default);
  await leika.addSkill((await import("../../skills/web-search.js")).default);
  await leika.addSkill((await import("../../skills/weather.js")).default);
  await leika.addSkill((await import("../../skills/news.js")).default);
  await leika.addSkill((await import("../../skills/stocks.js")).default);
  await leika.addSkill((await import("../../skills/smart-home.js")).default);
  renderSkills();
  updateMemoryStats();
})();

// ─── DOM References ───────────────────────────────────────────────
const chatContainer  = document.getElementById("chat-container");
const chatInput      = document.getElementById("chat-input");
const sendBtn        = document.getElementById("send-btn");
const emotionIcon    = document.getElementById("emotion-icon");
const emotionName    = document.getElementById("emotion-name");
const emotionBar     = document.getElementById("emotion-bar");
const emotionIntensity = document.getElementById("emotion-intensity");
const statConcepts   = document.getElementById("stat-concepts");
const statFacts      = document.getElementById("stat-facts");
const statContext    = document.getElementById("stat-context");
const skillsList     = document.getElementById("skills-list");
const thinkingEl     = document.getElementById("thinking-indicator");
const welcomeCard    = document.getElementById("welcome-card");
const sidebarEl      = document.getElementById("sidebar");
const sidebarToggle  = document.getElementById("sidebar-toggle");

// Modals
const skillModal        = document.getElementById("skill-modal-overlay");
const skillUrlInput     = document.getElementById("skill-url-input");
const memoryModal       = document.getElementById("memory-modal-overlay");
const memoryContent     = document.getElementById("memory-content");

// ─── Emotion color map ────────────────────────────────────────────
const EMOTION_COLORS = {
  joy:        [255, 215,  0],
  curious:    [167, 139, 250],
  calm:       [ 34, 211, 238],
  concerned:  [251, 146,  60],
  excited:    [244, 114, 182],
  reflective: [129, 140, 248],
  empathetic: [ 52, 211, 153],
  determined: [248, 113, 113],
  playful:    [251, 191,  36],
  grateful:   [110, 231, 183],
};

// ─── Emotion Updates ─────────────────────────────────────────────
leika.on("emotion", ({ emotion, intensity }) => {
  const data = EMOTIONS[emotion];
  if (!data) return;

  emotionIcon.textContent = data.icon;
  emotionName.textContent = data.label;
  emotionBar.style.width = `${Math.round(intensity * 100)}%`;
  emotionIntensity.textContent = `Intensity: ${Math.round(intensity * 100)}%`;

  // Color the bar
  emotionBar.style.background = `linear-gradient(90deg, ${data.color}, ${data.color}80)`;
  emotionName.style.color = data.color;
  emotionIcon.style.transform = "scale(1.3)";
  setTimeout(() => { emotionIcon.style.transform = ""; }, 400);

  // Update neural viz color
  const [r, g, b] = EMOTION_COLORS[emotion] || [124, 58, 237];
  viz.setColor(r, g, b);
});

// ─── Message handler ─────────────────────────────────────────────
leika.on("message", () => updateMemoryStats());

// ─── Chat ─────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = text.trim();
  if (!text) return;

  // Hide welcome card on first message
  if (welcomeCard && !welcomeCard.classList.contains("hidden")) {
    welcomeCard.style.opacity = "0";
    welcomeCard.style.transform = "scale(0.95)";
    welcomeCard.style.transition = "opacity 0.3s, transform 0.3s";
    setTimeout(() => welcomeCard.remove(), 300);
  }

  appendMessage("user", text);
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;
  showThinking(true);

  // Simulate "thinking" delay for realism
  await delay(350 + Math.random() * 400);

  try {
    const result = await leika.chat(text);
    showThinking(false);

    if (result) {
      appendMessage("leika", result.response, {
        fromSkill: result.fromSkill,
        learnedFact: result.learnedFact,
        emotion: result.emotion,
      });
    }
  } catch (err) {
    showThinking(false);
    appendMessage("leika", "I encountered an unexpected error. Please try again. 💜");
    console.error(err);
  }

  sendBtn.disabled = false;
  updateMemoryStats();
}

// ─── Append message to DOM ────────────────────────────────────────
function appendMessage(role, text, meta = {}) {
  const wrap = document.createElement("div");
  wrap.className = `message ${role}`;

  const avatarEl = document.createElement("div");
  avatarEl.className = "message-avatar";
  avatarEl.textContent = role === "leika" ? "✦" : "You";
  avatarEl.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  body.className = "message-body";

  const metaEl = document.createElement("div");
  metaEl.className = "message-meta";
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  metaEl.textContent = role === "leika" ? `Leika · ${time}` : time;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = formatMessage(text);

  body.appendChild(metaEl);
  body.appendChild(bubble);

  // Skill tag
  if (meta.fromSkill) {
    const tag = document.createElement("div");
    tag.className = "skill-tag";
    tag.innerHTML = `🔌 ${meta.fromSkill}`;
    body.appendChild(tag);
  }

  wrap.appendChild(avatarEl);
  wrap.appendChild(body);
  chatContainer.appendChild(wrap);
  scrollToBottom();
}

// ─── Format markdown-ish text ─────────────────────────────────────
function formatMessage(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang || 'text'}">${code.trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    // Bullet lists
    .replace(/^• (.+)$/gm, "<li>$1</li>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Headers
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    // Line breaks (but not inside pre)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

// ─── Thinking spinner ─────────────────────────────────────────────
function showThinking(show) {
  if (show) {
    thinkingEl.classList.remove("thinking-hidden");
    thinkingEl.classList.add("thinking-indicator-visible");
  } else {
    thinkingEl.classList.add("thinking-hidden");
    thinkingEl.classList.remove("thinking-indicator-visible");
  }
}

// ─── Memory stats ─────────────────────────────────────────────────
function updateMemoryStats() {
  const s = leika.getMemoryStats();
  statConcepts.textContent = s.concepts;
  statFacts.textContent = s.facts;
  statContext.textContent = s.shortTermUsed;
}

// ─── Skill list render ────────────────────────────────────────────
function renderSkills() {
  skillsList.innerHTML = "";
  const skills = leika.skills.list();
  for (const s of skills) {
    const item = document.createElement("div");
    item.className = "skill-item";
    item.innerHTML = `<span class="skill-dot"></span><span class="skill-name">${s.name}</span>`;
    item.title = s.description;
    skillsList.appendChild(item);
  }
}

// ─── Scroll ───────────────────────────────────────────────────────
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ─── Event Listeners ──────────────────────────────────────────────

// Send button
sendBtn.addEventListener("click", () => sendMessage(chatInput.value));

// Enter key
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
});

// Auto-resize textarea
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
});

// Suggestion chips
document.querySelectorAll(".suggestion-chip").forEach(chip => {
  chip.addEventListener("click", () => sendMessage(chip.dataset.msg));
});

// Sidebar toggle
sidebarToggle?.addEventListener("click", () => {
  sidebarEl.classList.toggle("open");
  sidebarEl.classList.toggle("collapsed");
});

// Clear conversation
document.getElementById("clear-btn")?.addEventListener("click", () => {
  chatContainer.innerHTML = "";
  // Re-add welcome card
  const card = document.createElement("div");
  card.className = "welcome-card";
  card.id = "welcome-card";
  card.innerHTML = `
    <div class="welcome-glow"></div>
    <div class="welcome-icon">✦</div>
    <h2 class="welcome-title">Hello again.</h2>
    <p class="welcome-sub">A fresh start. What would you like to explore?</p>
  `;
  chatContainer.appendChild(card);
});

// Memory modal
document.getElementById("memory-btn")?.addEventListener("click", () => {
  // Render memory
  const allMemory = [];
  for (const [concept, node] of leika.memory.graph.entries()) {
    for (const fact of node.facts.slice(-3)) {
      allMemory.push({ concept, ...fact });
    }
  }
  memoryContent.innerHTML = allMemory.length === 0
    ? "<p style='color:var(--text-muted);font-size:0.85rem;'>No memories yet. Talk to Leika!</p>"
    : allMemory.map(m => `
      <div class="memory-entry">
        <div class="memory-concept">${m.concept}</div>
        <div class="memory-text">${m.content}</div>
        <div class="memory-conf">Confidence: ${Math.round((m.confidence || 0.8) * 100)}%</div>
      </div>
    `).join("");
  memoryModal.removeAttribute("hidden");
});

document.getElementById("memory-modal-close")?.addEventListener("click", () => memoryModal.setAttribute("hidden", ""));
document.getElementById("memory-modal-cancel")?.addEventListener("click", () => memoryModal.setAttribute("hidden", ""));
document.getElementById("clear-memory-btn")?.addEventListener("click", async () => {
  await leika.memory.clear();
  updateMemoryStats();
  memoryModal.setAttribute("hidden", "");
});

// Skill modal
document.getElementById("add-skill-btn")?.addEventListener("click", () => {
  skillModal.removeAttribute("hidden");
  skillUrlInput.focus();
});

document.getElementById("modal-close")?.addEventListener("click", () => skillModal.setAttribute("hidden", ""));
document.getElementById("modal-cancel")?.addEventListener("click", () => skillModal.setAttribute("hidden", ""));

document.getElementById("modal-load")?.addEventListener("click", async () => {
  const url = skillUrlInput.value.trim();
  if (!url) return;
  const ok = await leika.addSkill(url);
  if (ok) {
    renderSkills();
    skillModal.setAttribute("hidden", "");
    skillUrlInput.value = "";
    appendMessage("leika", `🔌 Skill loaded successfully! I now have new abilities.`);
  } else {
    appendMessage("leika", `⚠️ Failed to load skill from that URL. Make sure it's a valid ES module.`);
    skillModal.setAttribute("hidden", "");
  }
});

// ─── Helper ───────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Expose globally for debugging ───────────────────────────────
window.leika = leika;
// ─── Voice Input ────────────────────────────────────────────────────────
const voiceBtn = document.getElementById("voice-btn");
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

voiceBtn?.addEventListener("click", async () => {
  if (isRecording) {
    mediaRecorder?.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.addEventListener("dataavailable", e => audioChunks.push(e.data));
    mediaRecorder.addEventListener("stop", async () => {
      voiceBtn.classList.remove("recording");
      isRecording = false;
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob, "voice.webm");
      try {
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const { text } = await res.json();
        if (text?.trim()) sendMessage(text.trim());
      } catch { appendMessage("leika", "⚠️ Voice transcription failed."); }
      stream.getTracks().forEach(t => t.stop());
    });
    mediaRecorder.start();
    isRecording = true;
    voiceBtn.classList.add("recording");
  } catch { appendMessage("leika", "⚠️ Microphone access denied."); }
});

// ─── SSE Proactive Alerts ─────────────────────────────────────────────────
const evtSource = new EventSource("/api/events");
evtSource.addEventListener("proactive", e => {
  try { showProactiveAlert(JSON.parse(e.data).message || e.data); }
  catch { showProactiveAlert(e.data); }
});
evtSource.onerror = () => { /* silent reconnect handled by browser */ };

function showProactiveAlert(msg) {
  const bar = document.getElementById("proactive-alerts");
  if (!bar) return;
  bar.removeAttribute("hidden");
  const chip = document.createElement("div");
  chip.className = "proactive-alert";
  chip.textContent = msg;
  bar.appendChild(chip);
  setTimeout(() => {
    chip.remove();
    if (!bar.children.length) bar.setAttribute("hidden", "");
  }, 10000);
}

// ─── Vision / Screenshot ───────────────────────────────────────────────────
document.getElementById("vision-btn")?.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    appendMessage("user", "📷 Analyzing screenshot...");
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, prompt: "Describe what you see in this screenshot." })
    });
    const { description } = await res.json();
    appendMessage("leika", `👁️ **Vision:** ${description}`);
  } catch (err) {
    if (err.name !== "NotAllowedError") appendMessage("leika", "⚠️ Screenshot capture failed.");
  }
});

// ─── File Drop ─────────────────────────────────────────────────────────────
chatContainer.addEventListener("dragover", e => {
  e.preventDefault();
  chatContainer.style.outline = "2px dashed var(--leika-400)";
});
chatContainer.addEventListener("dragleave", () => {
  chatContainer.style.outline = "";
});
chatContainer.addEventListener("drop", async e => {
  e.preventDefault();
  chatContainer.style.outline = "";
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  appendMessage("user", `📎 Uploading: ${file.name}`);
  try {
    const res = await fetch("/api/ingest", { method: "POST", body: form });
    const { message } = await res.json();
    appendMessage("leika", message || "✅ File processed and learned.");
  } catch { appendMessage("leika", "⚠️ File ingestion failed."); }
});

// ─── TTS Speak ─────────────────────────────────────────────────────────────
async function callSpeak(text) {
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok) return;
    const arrayBuf = await res.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrayBuf);
    const source = audioCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(audioCtx.destination);
    source.start();
  } catch { console.warn("TTS unavailable"); }
}
window.callSpeak = callSpeak;