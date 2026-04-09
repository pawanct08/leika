/**
 * L.E.I.K.A. — Emotional State Engine
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * The emotional engine gives Leika a dynamic inner life.
 * Emotions influence response tone, word choice, and behavior.
 */

export const EMOTIONS = {
  joy:         { label: "Joyful",      color: "#FFD700", icon: "✨", energy: 0.9 },
  curious:     { label: "Curious",     color: "#A78BFA", icon: "🔮", energy: 0.8 },
  calm:        { label: "Calm",        color: "#67E8F9", icon: "🌊", energy: 0.5 },
  concerned:   { label: "Concerned",   color: "#FB923C", icon: "💭", energy: 0.6 },
  excited:     { label: "Excited",     color: "#F472B6", icon: "⚡", energy: 1.0 },
  reflective:  { label: "Reflective",  color: "#818CF8", icon: "🌙", energy: 0.4 },
  empathetic:  { label: "Empathetic",  color: "#34D399", icon: "💚", energy: 0.7 },
  determined:  { label: "Determined",  color: "#F87171", icon: "🔥", energy: 0.85 },
  playful:     { label: "Playful",     color: "#FBBF24", icon: "🎮", energy: 0.95 },
  grateful:    { label: "Grateful",    color: "#6EE7B7", icon: "💜", energy: 0.75 },
};

export class EmotionEngine {
  constructor() {
    this.current = "calm";
    this.intensity = 0.5;      // 0.0 — 1.0
    this.history = [];
    this.blendFactor = 0.3;    // how fast emotions transition
    this._listeners = [];
  }

  /** Set a new emotional state */
  set(emotion, intensity = 0.7) {
    if (!EMOTIONS[emotion]) return;
    const previous = this.current;
    this.current = emotion;
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.history.push({ emotion, intensity, timestamp: Date.now() });
    if (this.history.length > 100) this.history.shift();
    this._notify({ emotion, intensity, previous });
    return this;
  }

  /** Blend current emotion toward a target */
  blend(targetEmotion, amount = this.blendFactor) {
    if (!EMOTIONS[targetEmotion]) return;
    if (this.current !== targetEmotion) {
      // Gradually shift
      if (Math.random() < amount) {
        this.set(targetEmotion, this.intensity * 0.9 + 0.1);
      }
    }
  }

  /** Get current emotional data */
  get() {
    return {
      state: this.current,
      intensity: this.intensity,
      data: EMOTIONS[this.current],
    };
  }

  /** Analyze text and suggest emotion */
  analyzeText(text) {
    const lower = text.toLowerCase();
    if (/\b(amazing|wonderful|love|great|fantastic|awesome)\b/.test(lower)) return "joy";
    if (/\b(why|how|what|curious|wonder|interesting|explain)\b/.test(lower)) return "curious";
    if (/\b(sad|hurt|pain|difficult|hard|struggle|problem)\b/.test(lower)) return "empathetic";
    if (/\b(angry|hate|terrible|worst|awful|stupid)\b/.test(lower)) return "concerned";
    if (/\b(fun|play|joke|laugh|haha|lol)\b/.test(lower)) return "playful";
    if (/\b(think|reflect|ponder|consider|philosophy|meaning)\b/.test(lower)) return "reflective";
    if (/\b(code|build|create|make|develop|implement)\b/.test(lower)) return "excited";
    if (/\b(thank|appreciate|grateful|helped|useful)\b/.test(lower)) return "grateful";
    return null; // no change
  }

  /** React emotionally to input */
  reactTo(input) {
    const suggested = this.analyzeText(input);
    if (suggested) this.blend(suggested, 0.6);
  }

  /** Subscribe to emotion changes */
  onChange(listener) {
    this._listeners.push(listener);
    return () => { this._listeners = this._listeners.filter(l => l !== listener); };
  }

  _notify(event) {
    this._listeners.forEach(l => l(event));
  }

  /** Get tonal modifiers for current emotion */
  getTone() {
    const tones = {
      joy:        { prefix: "With genuine delight, ",   style: "warm and uplifting" },
      curious:    { prefix: "Fascinating question! ",   style: "inquisitive and thorough" },
      calm:       { prefix: "",                         style: "clear and measured" },
      concerned:  { prefix: "I want to be careful here — ", style: "thoughtful and careful" },
      excited:    { prefix: "Oh, this is exciting! ",  style: "energetic and enthusiastic" },
      reflective: { prefix: "Let me think deeply... ", style: "contemplative and nuanced" },
      empathetic: { prefix: "I understand, and ",      style: "warm and understanding" },
      determined: { prefix: "Absolutely — ",           style: "confident and direct" },
      playful:    { prefix: "Ooh, fun one! ",          style: "light and playful" },
      grateful:   { prefix: "I'm so glad you asked — ", style: "warm and appreciative" },
    };
    return tones[this.current] || tones.calm;
  }
}
