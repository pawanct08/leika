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
