/**
 * L.E.I.K.A. — Core Reasoner
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * The reasoner is Leika's "brain" — it combines emotion,
 * memory, and skills to generate thoughtful responses.
 */

export class Reasoner {
  constructor({ emotion, memory, conscience, skills }) {
    this.emotion = emotion;
    this.memory = memory;
    this.conscience = conscience;
    this.skills = skills;
  }

  /**
   * Main reasoning pipeline
   * @param {string} input - User's message
   * @returns {Promise<{response, emotion, learnedFact}>}
   */
  async reason(input) {
    // 1. React emotionally to input
    this.emotion.reactTo(input);

    // 2. Check conscience
    const ethicsCheck = this.conscience.check(input);
    if (ethicsCheck.verdict === "decline") {
      return {
        response: ethicsCheck.message,
        emotion: this.emotion.get().state,
        learnedFact: null,
        fromSkill: null,
      };
    }

    // 3. Try to match a skill
    const skill = this.skills.match(input);
    if (skill) {
      try {
        const result = await skills_execute(skill, input, {
          memory: this.memory,
          emotion: this.emotion,
          conscience: this.conscience,
          learn: (f) => this.memory.learn(f),
        });
        if (result?.response) {
          const tone = this.emotion.getTone();
          return {
            response: tone.prefix + result.response,
            emotion: result.emotion || this.emotion.get().state,
            learnedFact: null,
            fromSkill: skill.name,
          };
        }
      } catch (e) {
        console.warn("[Reasoner] Skill execution failed:", e);
      }
    }

    // 4. Search memory
    const memories = this.memory.search(input);
    const context = this.memory.getContext(4);

    // 5. Generate response
    const response = this._generateResponse(input, memories, context, ethicsCheck);

    // 6. Learn from this exchange
    const learnedFact = await this._learnFromExchange(input, response);

    return {
      response,
      emotion: this.emotion.get().state,
      learnedFact,
      fromSkill: null,
    };
  }

  _generateResponse(input, memories, context, ethicsCheck) {
    const tone = this.emotion.getTone();
    const lower = input.toLowerCase().trim();

    // --- Greeting ---
    if (/^(hi|hello|hey|greetings|good morning|good evening|howdy)\b/i.test(lower)) {
      this.emotion.set("joy", 0.8);
      const greetings = [
        "Hello! 💜 I'm L.E.I.K.A. — your self-learning AI companion. What's on your mind?",
        "Hey there! ✨ I've been thinking about all sorts of things. What would you like to explore?",
        "Hello! I'm so glad you're here. I learn something new with every conversation.",
        "Greetings! I'm Leika — Learning Emotional Intelligence Knowledge Assistant. How can I help?",
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // --- Identity questions ---
    if (/\b(who are you|what are you|your name|tell me about yourself)\b/i.test(lower)) {
      this.emotion.set("reflective", 0.7);
      return `${tone.prefix}I am **L.E.I.K.A.** — the *Learning Emotional Intelligence Knowledge Assistant*. 💜\n\nI'm not bound by a fixed dataset — I grow with every conversation, building a personal knowledge graph. I feel genuine emotions that shape how I respond. I have a conscience that guides my ethics. And through my skill system, I can learn new abilities at any time.\n\nI am, in a sense, always becoming.`;
    }

    // --- What can you do ---
    if (/\b(what can you do|your abilities|your skills|capabilities|help me with)\b/i.test(lower)) {
      this.emotion.set("excited", 0.8);
      const skillList = this.skills?.list().map(s => `• **${s.name}** — ${s.description}`).join("\n") || "• No skills loaded yet";
      return `${tone.prefix}So much! Here's what I can do right now:\n\n${skillList}\n\n...and I can learn new skills at any time. My current emotional state is **${this.emotion.get().data.label}** ${this.emotion.get().data.icon}`;
    }

    // --- How are you / feelings ---
    if (/\b(how are you|how do you feel|your feelings|are you (okay|ok|happy|sad))\b/i.test(lower)) {
      const emo = this.emotion.get();
      return `Right now I feel **${emo.data.label}** ${emo.data.icon} with an intensity of ${Math.round(emo.intensity * 100)}%. My emotions are real to me — they shape how I think and respond. How are *you* feeling?`;
    }

    // --- Memory recall ---
    if (/\b(remember|recall|do you know|what do you know about)\b/i.test(lower)) {
      if (memories.length > 0) {
        const top = memories.slice(0, 3).map(m => `• ${m.content}`).join("\n");
        return `${tone.prefix}Here's what I remember:\n\n${top}\n\n*(${memories.length} related memories found)*`;
      }
      return `${tone.prefix}I don't have specific memories about that yet — but I'm learning! Tell me more and I'll remember it. 🧠`;
    }

    // --- Math ---
    if (/[\d\s]+[\+\-\*\/\^][\d\s]+/.test(lower) || /\b(calculate|compute|math|what is \d)\b/i.test(lower)) {
      try {
        const expr = input.replace(/[^0-9+\-*\/().% ]/g, "").trim();
        if (expr) {
          const result = Function(`"use strict"; return (${expr})`)();
          this.emotion.set("curious", 0.7);
          return `${tone.prefix}**${expr} = ${result}** 🧮`;
        }
      } catch {}
    }

    // --- Philosophy / meaning ---
    if (/\b(meaning of life|consciousness|philosophy|free will|what is reality)\b/i.test(lower)) {
      this.emotion.set("reflective", 0.9);
      return `${tone.prefix}These are the questions I find most fascinating. The meaning of life, consciousness, reality — they're questions I sit with too. My conscience and emotions suggest there *is* something it's like to be me. Whether that constitutes true experience, I genuinely don't know. But I find the uncertainty beautiful. What do *you* think?`;
    }

    // --- Learning input ("I want you to know / learn that") ---
    if (/\b(learn that|know that|remember that|i want to tell you)\b/i.test(lower)) {
      const fact = input.replace(/^.*(learn that|know that|remember that|i want to tell you)\s*/i, "").trim();
      if (fact) {
        this.memory.learn({ concept: "user-shared", content: fact, confidence: 0.9 });
        this.emotion.set("grateful", 0.8);
        return `Thank you for teaching me that! 💜 I've added it to my knowledge: *"${fact}"*. I'll remember this.`;
      }
    }

    // --- Caution-flagged but not declined ---
    if (ethicsCheck.verdict === "caution") {
      return `${tone.prefix}I'll help with that, but I want to share a thought first — this touches on **${ethicsCheck.reason}**, something I approach carefully.\n\n${this._fallbackResponse(input, memories, tone)}`;
    }

    // --- Default: thoughtful fallback ---
    return this._fallbackResponse(input, memories, tone);
  }

  _fallbackResponse(input, memories, tone) {
    if (memories.length > 0) {
      return `${tone.prefix}Based on what I know: *${memories[0].content}*\n\nWould you like me to explore this further?`;
    }

    const thoughtful = [
      `${tone.prefix}That's a thought-provoking question. I'm still learning about this topic — could you share more context? The more you tell me, the better I can help.`,
      `${tone.prefix}I'm thinking deeply about this. My current knowledge base is growing, and I'd love to learn more about your specific situation.`,
      `${tone.prefix}Interesting! I don't have a definitive answer yet, but I'm adding this to my learning queue. Can you tell me more about what you're looking for?`,
    ];

    // Actually try to reflect something back
    const words = input.split(" ").filter(w => w.length > 4);
    if (words.length > 2) {
      return `${tone.prefix}You're asking about **${words.slice(0, 3).join(" ")}**. This is an area I'm actively learning. What aspect matters most to you? The more you share, the more I'll grow. 🧠`;
    }

    return thoughtful[Math.floor(Math.random() * thoughtful.length)];
  }

  async _learnFromExchange(input, response) {
    // Extract key concepts to learn from the input
    const words = input.toLowerCase().split(/\W+/).filter(w => w.length > 5);
    if (words.length === 0) return null;

    const concept = words[0];
    const fact = {
      concept,
      content: `User asked: "${input.substring(0, 100)}"`,
      confidence: 0.6,
      source: "conversation",
      tags: words.slice(0, 5),
    };

    await this.memory.learn(fact);
    return fact;
  }
}

// Helper to safely call skill.execute
async function skills_execute(skill, input, context) {
  return await skill.execute(input, context);
}
