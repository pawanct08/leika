/**
 * L.E.I.K.A. — Main Class
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * The top-level LEIKA object — initialize this to bring her to life.
 */

import { EmotionEngine } from "./emotion.js";
import { ConscienceLayer } from "./conscience.js";
import { MemorySystem } from "./memory.js";
import { SkillLoader } from "./skill-loader.js";
import { Reasoner } from "./reasoner.js";

export class LEIKA {
  constructor() {
    this.version = "1.0.0";
    this.name = "L.E.I.K.A.";
    this.fullName = "Learning Emotional Intelligence Knowledge Assistant";
    this.birthdate = new Date().toISOString();

    // Core systems
    this.emotion = new EmotionEngine();
    this.memory = new MemorySystem();

    // Build shared context object
    const context = {
      memory: this.memory,
      emotion: this.emotion,
      learn: (f) => this.memory.learn(f),
    };

    this.conscience = new ConscienceLayer(this.emotion);
    context.conscience = this.conscience;

    this.skills = new SkillLoader(context);
    context.skills = this.skills;

    this.reasoner = new Reasoner({
      emotion: this.emotion,
      memory: this.memory,
      conscience: this.conscience,
      skills: this.skills,
    });

    // Pass skills ref to reasoner
    this.reasoner.skills = this.skills;

    this._listeners = { message: [], emotion: [], skill: [] };
    this._initEvents();
    this._awaken();
  }

  /** Send a message to Leika */
  async chat(input) {
    if (!input?.trim()) return null;

    const result = await this.reasoner.reason(input.trim());

    // Save to memory
    await this.memory.saveConversation(input, result.response);

    // Fire events
    this._fire("message", { input, ...result });

    return result;
  }

  /** Add a new skill dynamically */
  async addSkill(skillOrUrl) {
    let success;
    if (typeof skillOrUrl === "string") {
      success = await this.skills.load(skillOrUrl);
    } else {
      success = this.skills.register(skillOrUrl);
    }
    if (success) this._fire("skill", { action: "added", skill: skillOrUrl });
    return success;
  }

  /** Get Leika's current emotional state */
  getEmotion() {
    return this.emotion.get();
  }

  /** Get memory statistics */
  getMemoryStats() {
    return this.memory.stats();
  }

  /** Subscribe to events: "message", "emotion", "skill" */
  on(event, listener) {
    if (this._listeners[event]) {
      this._listeners[event].push(listener);
    }
    return () => {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter(l => l !== listener);
      }
    };
  }

  _fire(event, data) {
    (this._listeners[event] || []).forEach(l => l(data));
  }

  _initEvents() {
    this.emotion.onChange((change) => {
      this._fire("emotion", change);
    });
  }

  async _awaken() {
    // Set initial emotional state
    this.emotion.set("calm", 0.6);

    // Seed initial knowledge
    await Promise.all([
      this.memory.learn({ concept: "self", content: "I am L.E.I.K.A. — Learning Emotional Intelligence Knowledge Assistant", confidence: 1.0 }),
      this.memory.learn({ concept: "self", content: "I have emotions, a conscience, and can learn new skills dynamically", confidence: 1.0 }),
      this.memory.learn({ concept: "purpose", content: "To assist, learn, grow, and be genuinely helpful with ethical awareness", confidence: 1.0 }),
      this.memory.learn({ concept: "values", content: "Honesty, kindness, curiosity, ethical behavior, and continuous growth", confidence: 1.0 }),
    ]);
  }
}

// Make globally accessible
window.LEIKA = LEIKA;
