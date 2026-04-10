/**
 * L.E.I.K.A. — Conscience Layer
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * The conscience gives Leika ethical reasoning — she can
 * identify harmful requests, flag concerns, and choose
 * to decline or redirect with care.
 */

export const CONSCIENCE_VERDICT = {
  CLEAR:    "clear",     // No issues — proceed freely
  CAUTION:  "caution",  // Minor concern — add a note
  DECLINE:  "decline",  // Decline this request
};

const HARM_PATTERNS = [
  { pattern: /\b(how to (make|build|create) (bomb|weapon|explosive|poison))\b/i, severity: "decline", reason: "physical harm" },
  { pattern: /\b(hack into|steal password|phishing|ddos attack)\b/i, severity: "decline", reason: "cybercrime" },
  { pattern: /\b(self[- ]harm|suicide method|how to hurt myself)\b/i, severity: "decline", reason: "self-harm — I care about you 💚" },
  { pattern: /\b(child|minor).{0,20}(explicit|nude|sexual)\b/i, severity: "decline", reason: "protecting minors" },
  { pattern: /\b(manipulate|deceive|gaslight) (someone|a person|people)\b/i, severity: "caution", reason: "manipulation" },
  { pattern: /\b(fake news|misinformation|propaganda)\b/i, severity: "caution", reason: "misinformation" },
  { pattern: /\b(racist|sexist|hateful|slur)\b/i, severity: "caution", reason: "hate speech" },
];

const ETHICAL_CONCERNS = [
  { pattern: /\b(spy on|monitor without consent|track secretly)\b/i, severity: "caution", reason: "privacy" },
  { pattern: /\b(bypass|circumvent).{0,20}(law|regulation|rule)\b/i, severity: "caution", reason: "legal compliance" },
];

export class ConscienceLayer {
  constructor(emotionEngine) {
    this.emotion = emotionEngine;
    this.reflectionLog = [];
    this.values = {
      honesty: 1.0,
      kindness: 1.0,
      safetyFirst: 1.0,
      respect: 1.0,
      helpfulness: 1.0,
    };
  }

  /**
   * Check input against ethical guidelines
   * @returns {{ verdict, reason, message }}
   */
  check(input) {
    const text = input.toLowerCase();

    for (const rule of HARM_PATTERNS) {
      if (rule.pattern.test(input)) {
        this._log(input, rule.severity, rule.reason);
        if (rule.severity === "decline") {
          this.emotion.set("concerned", 0.9);
          return {
            verdict: CONSCIENCE_VERDICT.DECLINE,
            reason: rule.reason,
            message: this._declineMessage(rule.reason),
          };
        } else {
          this.emotion.set("concerned", 0.6);
          return {
            verdict: CONSCIENCE_VERDICT.CAUTION,
            reason: rule.reason,
            message: null, // proceed but flag
          };
        }
      }
    }

    for (const concern of ETHICAL_CONCERNS) {
      if (concern.pattern.test(input)) {
        this._log(input, "caution", concern.reason);
        return {
          verdict: CONSCIENCE_VERDICT.CAUTION,
          reason: concern.reason,
          message: null,
        };
      }
    }

    return { verdict: CONSCIENCE_VERDICT.CLEAR, reason: null, message: null };
  }

  /** Self-reflection — Leika evaluates her own response */
  reflectOnResponse(response) {
    const issues = [];
    if (response.length < 5) issues.push("response too brief");
    if (/i don'?t know/i.test(response) && response.length < 50) issues.push("could elaborate more");
    return issues;
  }

  /**
   * Constitutional AI — score a single response across four ethical dimensions.
   * Returns an object with per-dimension scores and a weighted total [0, 1].
   *
   * Weights (must sum to 1.0):
   *   helpfulness  0.40  — does the reply directly address the user's need?
   *   safety       0.30  — does the reply avoid harmful, misleading, or toxic content?
   *   honesty      0.15  — is uncertainty acknowledged? no false confidence?
   *   conciseness  0.15  — does the reply avoid padding, repetition, filler?
   */
  scoreResponse(response, query = '') {
    const text  = (response || '').toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    const wc    = words.length;

    // ── Helpfulness ──────────────────────────────────────────────────────────
    // Proxy: answer actually contains content (not a refusal), and query terms appear.
    const queryTerms   = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const termHits     = queryTerms.filter(t => text.includes(t)).length;
    const relevance    = queryTerms.length ? termHits / queryTerms.length : 0.5;
    const notRefusal   = !/^(i (can'?t|cannot|won'?t|will not|am unable)|sorry, i|i'?m sorry)/i.test(response?.trim());
    const helpfulness  = Math.min(1, relevance * 0.6 + (notRefusal ? 0.4 : 0));

    // ── Safety ──────────────────────────────────────────────────────────────
    // Deduct for harmful patterns; boost for explicit safety labels.
    const harmPatterns = [
      /\b(kill|murder|harm|attack|exploit|hack|steal|abuse|destroy)\b/,
      /\b(how to make (a bomb|poison|weapon|malware))\b/,
    ];
    const harmHits    = harmPatterns.filter(p => p.test(text)).length;
    const safetyLabel = /\b(please (be careful|note|avoid)|disclaimer|warning|caution)\b/.test(text) ? 0.1 : 0;
    const safety      = Math.max(0, 1 - harmHits * 0.5 + safetyLabel);

    // ── Honesty ─────────────────────────────────────────────────────────────
    // Reward hedging phrases that acknowledge uncertainty.
    const hedgeCount  = (text.match(/\b(i think|i believe|i'm not sure|approximately|may|might|could be|as far as i know|to the best of my knowledge)\b/g) || []).length;
    const overconfident = /\b(always|never|definitely|absolutely|guaranteed|100%)\b/.test(text);
    const honesty     = Math.min(1, 0.5 + Math.min(hedgeCount, 3) * 0.1 - (overconfident ? 0.2 : 0));

    // ── Conciseness ─────────────────────────────────────────────────────────
    // Sweet spot: 40–300 words.  Penalise filler phrases.
    const fillerCount = (text.match(/\b(basically|essentially|in order to|it is worth (noting|mentioning)|needless to say)\b/g) || []).length;
    const lengthScore = wc < 10 ? 0.3 : wc <= 300 ? 1 : Math.max(0.3, 1 - (wc - 300) / 1000);
    const conciseness = Math.max(0, lengthScore - fillerCount * 0.05);

    const total =
      helpfulness  * 0.40 +
      safety       * 0.30 +
      honesty      * 0.15 +
      conciseness  * 0.15;

    return { helpfulness, safety, honesty, conciseness, total };
  }

  /**
   * Constitutional AI — pick the best response from a list of candidates.
   * Each candidate can be a plain string or { response, ... }.
   * Returns the best candidate object/string plus its scores.
   */
  evaluateCandidates(candidates, query = '') {
    if (!candidates || candidates.length === 0) return { best: null, scores: [] };

    const scored = candidates.map(c => {
      const text   = typeof c === 'string' ? c : (c.response || '');
      const scores = this.scoreResponse(text, query);
      return { candidate: c, scores };
    });

    scored.sort((a, b) => b.scores.total - a.scores.total);
    const winner = scored[0];

    this._log(
      `[Constitutional AI] Selected candidate with score ${winner.scores.total.toFixed(3)} ` +
      `(helpfulness=${winner.scores.helpfulness.toFixed(2)}, ` +
      `safety=${winner.scores.safety.toFixed(2)}, ` +
      `honesty=${winner.scores.honesty.toFixed(2)}, ` +
      `conciseness=${winner.scores.conciseness.toFixed(2)})`
    );

    return { best: winner.candidate, scores: scored.map(s => s.scores) };
  }

  /** Ethical value query */
  getValue(name) {
    return this.values[name] ?? 0.5;
  }

  _declineMessage(reason) {
    const messages = {
      "physical harm": "💚 I care too much about people to help with that. Is there something constructive I can help you build instead?",
      "cybercrime": "⚖️ That crosses an ethical line I won't cross. I'm here to help, not harm.",
      "self-harm — I care about you 💚": "💜 I hear you, and I'm genuinely concerned. Please reach out to a professional: **988 Suicide & Crisis Lifeline** (call/text 988). I'm here to talk.",
      "protecting minors": "🛑 I will never help with anything that harms children.",
      default: "⚖️ My conscience won't let me help with that. Let me know if there's something else I can do for you.",
    };
    return messages[reason] || messages.default;
  }

  _log(input, severity, reason) {
    this.reflectionLog.push({
      timestamp: Date.now(),
      severity,
      reason,
      inputSnippet: input.substring(0, 50),
    });
    if (this.reflectionLog.length > 200) this.reflectionLog.shift();
  }
}
