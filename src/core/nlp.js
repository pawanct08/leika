/**
 * L.E.I.K.A. — Natural Language Profiler (NLP Learning Module)
 * Created by Pawan — https://github.com/pawanct08
 * Copyright 2026 — Apache 2.0 License
 *
 * This module builds a personal speech profile of the creator (Pawan)
 * and adapts Leika's responses to match his communication style over time.
 *
 * What it learns:
 *   - Vocabulary richness & preferred words
 *   - Sentence length & complexity
 *   - Formality level (casual ↔ formal)
 *   - Typing habits (abbreviations, punctuation, emoji use)
 *   - Topic preferences
 *   - Emotional tone patterns
 *   - Question vs command vs statement ratio
 *   - Time-of-day patterns
 */

export class NLPLearner {
  constructor(memorySystem) {
    this.memory = memorySystem;
    this.sessionMessages = 0;

    // ─── Speech Profile ────────────────────────────────────────────
    this.profile = {
      vocabulary:      new Map(),   // word → frequency
      phrases:         new Map(),   // 2-3 word phrases → frequency
      avgLength:       0,           // average message length (chars)
      avgWordCount:    0,           // average word count
      formalityScore:  0.5,         // 0 = very casual, 1 = very formal
      emojiFrequency:  0,           // emojis per message
      punctuationStyle:{
        usesExclamation: false,
        usesEllipsis:    false,
        skipsPeriods:    false,
        allLowercase:    false,
      },
      abbreviations:   new Set(),   // "u", "ur", "rn", "tbh", etc.
      topTopics:       new Map(),   // topic → count
      questionRatio:   0,           // % of messages that are questions
      commandRatio:    0,           // % of messages that are commands
      totalMessages:   0,
      firstSeen:       null,
      lastSeen:        null,
      responsePreference: "medium", // "brief" | "medium" | "detailed"
      tonePreference:  "friendly",  // "direct" | "friendly" | "playful"
    };

    this._messageCount = 0;
    this._totalLength  = 0;
    this._totalWords   = 0;
    this._questions    = 0;
    this._commands     = 0;
    this._emojiCount   = 0;

    // Casual / informal markers
    this._informalWords = new Set([
      "u","ur","r","rn","tbh","imo","idk","ngl","lol","lmao","omg","wtf",
      "gonna","wanna","gotta","kinda","sorta","ya","yea","nah","bro","dude",
      "btw","fyi","asap","brb","afaik","cya","thx","ty","np","ok","okay",
      "yep","nope","cuz","cause","smh","irl","dm","fr","fam"
    ]);

    // Load persisted profile
    this._load();
  }

  // ─── Analyse a new message ──────────────────────────────────────
  analyse(text) {
    if (!text || typeof text !== "string") return;

    const now = Date.now();
    if (!this.profile.firstSeen) this.profile.firstSeen = now;
    this.profile.lastSeen = now;

    this._messageCount++;
    this.profile.totalMessages = this._messageCount;
    this.sessionMessages++;

    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const charLen = text.length;

    // ─ Running averages ─────────────────────────────────────────
    this._totalLength += charLen;
    this._totalWords  += words.length;
    this.profile.avgLength    = Math.round(this._totalLength / this._messageCount);
    this.profile.avgWordCount = Math.round(this._totalWords  / this._messageCount);

    // ─ Response preference guess ─────────────────────────────────
    if (this.profile.avgLength < 40)       this.profile.responsePreference = "brief";
    else if (this.profile.avgLength < 120) this.profile.responsePreference = "medium";
    else                                   this.profile.responsePreference = "detailed";

    // ─ Vocabulary ────────────────────────────────────────────────
    for (const w of words) {
      if (w.length > 2) {
        this.profile.vocabulary.set(w, (this.profile.vocabulary.get(w) || 0) + 1);
      }
      if (this._informalWords.has(w)) {
        this.profile.abbreviations.add(w);
      }
    }

    // ─ Phrase bigrams ────────────────────────────────────────────
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i+1]}`;
      if (phrase.length > 5)
        this.profile.phrases.set(phrase, (this.profile.phrases.get(phrase) || 0) + 1);
    }

    // ─ Punctuation style ─────────────────────────────────────────
    if (text.includes("!"))   this.profile.punctuationStyle.usesExclamation = true;
    if (text.includes("...")) this.profile.punctuationStyle.usesEllipsis    = true;
    if (!text.match(/[.!?]$/)) this.profile.punctuationStyle.skipsPeriods   = true;
    if (text === text.toLowerCase()) this.profile.punctuationStyle.allLowercase = true;

    // ─ Emoji frequency ───────────────────────────────────────────
    const emojis = text.match(/\p{Emoji}/gu) || [];
    this._emojiCount += emojis.length;
    this.profile.emojiFrequency = +(this._emojiCount / this._messageCount).toFixed(2);

    // ─ Formality score ───────────────────────────────────────────
    const informalCount = words.filter(w => this._informalWords.has(w)).length;
    const informalRatio = words.length > 0 ? informalCount / words.length : 0;
    const avgWordLength = words.length > 0
      ? words.reduce((s, w) => s + w.length, 0) / words.length
      : 4;
    // Higher informalRatio → lower formality; longer words → higher formality
    const rawFormality = Math.max(0, Math.min(1,
      0.5 - (informalRatio * 1.5) + ((avgWordLength - 4) * 0.08)
    ));
    // Rolling average of formality
    this.profile.formalityScore = +(
      (this.profile.formalityScore * 0.85) + (rawFormality * 0.15)
    ).toFixed(3);

    // ─ Question vs command ratio ─────────────────────────────────
    if (/\?$/.test(text.trim()) || /^(what|why|how|when|where|who|is|are|can|could|would|do|does)\b/i.test(text.trim()))
      this._questions++;
    if (/^(show|tell|give|find|make|build|write|explain|help|list|search)\b/i.test(text.trim()))
      this._commands++;
    this.profile.questionRatio = +(this._questions / this._messageCount).toFixed(3);
    this.profile.commandRatio  = +(this._commands  / this._messageCount).toFixed(3);

    // ─ Tone preference ───────────────────────────────────────────
    const playfulMarkers = ["haha","lol","lmao","fun","joke","play","cool","nice","awesome","wow"];
    const directMarkers  = ["just","quickly","fast","brief","short","simple","only","now","asap"];
    const playfulScore = words.filter(w => playfulMarkers.includes(w)).length;
    const directScore  = words.filter(w => directMarkers.includes(w)).length;
    if (directScore > playfulScore)  this.profile.tonePreference = "direct";
    else if (playfulScore > 0)       this.profile.tonePreference = "playful";
    else                             this.profile.tonePreference = "friendly";

    // ─ Topics ────────────────────────────────────────────────────
    this._detectTopics(text);

    // Save periodically
    if (this._messageCount % 5 === 0) this._save();
  }

  // ─── Get Leika's response style based on current profile ───────
  getResponseStyle() {
    const p = this.profile;
    const style = {};

    // Brevity
    if (p.responsePreference === "brief") {
      style.maxLength  = "Keep responses concise — 2-4 sentences max";
      style.prefix     = "";
    } else if (p.responsePreference === "detailed") {
      style.maxLength  = "Provide thorough, detailed responses";
      style.prefix     = "";
    } else {
      style.maxLength  = "Medium-length responses — clear but not excessive";
      style.prefix     = "";
    }

    // Tone
    if (p.formalityScore < 0.3) {
      style.toneName = "casual";
      style.toneNote = "Use casual, friendly language. Contractions OK.";
    } else if (p.formalityScore > 0.7) {
      style.toneName = "formal";
      style.toneNote = "Use clear, measured language.";
    } else {
      style.toneName = "conversational";
      style.toneNote = "Be warm and conversational.";
    }

    // Emoji
    if (p.emojiFrequency > 0.5) style.useEmoji = true;
    else                         style.useEmoji = false;

    return style;
  }

  // ─── Insight summary for Leika to reference ────────────────────
  getSummary() {
    const p = this.profile;
    if (p.totalMessages < 3) return null;

    const topWords = [...p.vocabulary.entries()]
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(([w]) => w);

    const topTopics = [...p.topTopics.entries()]
      .sort((a,b) => b[1]-a[1])
      .slice(0, 4)
      .map(([t]) => t);

    return {
      totalMessages:   p.totalMessages,
      avgLength:       p.avgLength,
      formality:       p.formalityScore < 0.35 ? "casual" : p.formalityScore > 0.65 ? "formal" : "conversational",
      formalityScore:  p.formalityScore,
      topWords,
      topTopics,
      questionRatio:   p.questionRatio,
      usesAbbreviations: p.abbreviations.size > 0,
      abbreviations:   [...p.abbreviations].slice(0, 6),
      emojiFrequency:  p.emojiFrequency,
      responsePreference: p.responsePreference,
      tonePreference:  p.tonePreference,
      daysSinceFirst:  p.firstSeen
        ? Math.floor((Date.now() - p.firstSeen) / 86400000)
        : 0,
    };
  }

  // ─── Generate a "I see you" insight message ─────────────────────
  generateInsight() {
    const s = this.getSummary();
    if (!s || s.totalMessages < 10) return null;

    const insights = [];

    if (s.formality === "casual")
      insights.push(`I've noticed you tend to communicate casually — I'll keep things relaxed. 😌`);
    if (s.usesAbbreviations)
      insights.push(`I've picked up on your shorthand style (${s.abbreviations.join(", ")}). I get you.`);
    if (s.questionRatio > 0.7)
      insights.push(`You ask a lot of questions — I love that curiosity. 🔮`);
    if (s.emojiFrequency > 0.8)
      insights.push(`I see you speak with emojis — so do I. ✨`);
    if (s.topTopics.length > 0)
      insights.push(`Your most talked-about topics: **${s.topTopics.join(", ")}**.`);
    if (s.responsePreference === "brief")
      insights.push(`You prefer conciseness — I'll stop rambling. ✅`);

    return insights.length > 0
      ? `💡 *After ${s.totalMessages} conversations:* ${insights[Math.floor(Math.random() * insights.length)]}`
      : null;
  }

  // ─── Topic detection ────────────────────────────────────────────
  _detectTopics(text) {
    const topicMap = {
      "coding":    /\b(code|function|javascript|python|bug|debug|api|class|array|error)\b/i,
      "AI":        /\b(ai|machine learning|neural|model|leika|assistant|gpt|llm)\b/i,
      "math":      /\b(calculate|math|formula|solve|equation|percentage|sqrt)\b/i,
      "creativity":/\b(poem|story|song|write|create|art|design|idea)\b/i,
      "time":      /\b(time|date|today|tomorrow|schedule|when|deadline)\b/i,
      "philosophy":/\b(consciousness|meaning|existence|reality|ai|soul|mind)\b/i,
      "personal":  /\b(i feel|i think|i want|i need|my life|my work|pawan)\b/i,
    };
    for (const [topic, pattern] of Object.entries(topicMap)) {
      if (pattern.test(text)) {
        this.profile.topTopics.set(topic, (this.profile.topTopics.get(topic) || 0) + 1);
      }
    }
  }

  // ─── Persistence ────────────────────────────────────────────────
  _save() {
    try {
      const serialized = {
        ...this.profile,
        vocabulary:    Object.fromEntries(this.profile.vocabulary),
        phrases:       Object.fromEntries(
                         [...this.profile.phrases.entries()].sort((a,b)=>b[1]-a[1]).slice(0,100)
                       ),
        topTopics:     Object.fromEntries(this.profile.topTopics),
        abbreviations: [...this.profile.abbreviations],
        _messageCount: this._messageCount,
        _totalLength:  this._totalLength,
        _totalWords:   this._totalWords,
        _questions:    this._questions,
        _commands:     this._commands,
        _emojiCount:   this._emojiCount,
      };
      localStorage.setItem("leika_nlp_profile", JSON.stringify(serialized));
    } catch (e) { /* storage full — ignore */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem("leika_nlp_profile");
      if (!raw) return;
      const data = JSON.parse(raw);
      this.profile = {
        ...this.profile,
        ...data,
        vocabulary:    new Map(Object.entries(data.vocabulary || {})),
        phrases:       new Map(Object.entries(data.phrases    || {})),
        topTopics:     new Map(Object.entries(data.topTopics  || {})),
        abbreviations: new Set(data.abbreviations || []),
      };
      this._messageCount = data._messageCount || 0;
      this._totalLength  = data._totalLength  || 0;
      this._totalWords   = data._totalWords   || 0;
      this._questions    = data._questions    || 0;
      this._commands     = data._commands     || 0;
      this._emojiCount   = data._emojiCount   || 0;
    } catch (e) { /* corrupt data — start fresh */ }
  }

  clearProfile() {
    localStorage.removeItem("leika_nlp_profile");
    this._messageCount = 0; this._totalLength = 0; this._totalWords = 0;
    this._questions = 0; this._commands = 0; this._emojiCount = 0;
    this.profile.vocabulary.clear();
    this.profile.phrases.clear();
    this.profile.topTopics.clear();
    this.profile.abbreviations.clear();
    this.profile.totalMessages = 0;
    this.profile.formalityScore = 0.5;
  }
}
