/**
 * L.E.I.K.A. — Dynamic Skill Loader
 * Learning Emotional Intelligence Knowledge Assistant
 *
 * Copyright 2026 — Apache 2.0 License
 *
 * Loads JavaScript skill modules at runtime.
 * Skills can be added without restarting Leika.
 */

export class SkillLoader {
  constructor(context) {
    this.skills = new Map();
    this.context = context; // { memory, emotion, conscience, learn }
  }

  /** Register a skill object directly */
  register(skill) {
    if (!skill.id || !skill.execute) {
      console.warn("[SkillLoader] Skill missing required fields:", skill);
      return false;
    }
    this.skills.set(skill.id, skill);
    if (skill.onLoad) skill.onLoad(this.context).catch(console.warn);
    console.log(`[LEIKA] Skill loaded: ${skill.name} (${skill.id})`);
    return true;
  }

  /** Load a skill from a URL/path (ES module) */
  async load(url) {
    try {
      const module = await import(url);
      const skill = module.default;
      return this.register(skill);
    } catch (err) {
      console.error(`[SkillLoader] Failed to load skill from ${url}:`, err);
      return false;
    }
  }

  /** Find the best matching skill for an input */
  match(input) {
    const lowerInput = input.toLowerCase();
    let bestSkill = null;
    let bestScore = 0;

    for (const skill of this.skills.values()) {
      let score = 0;
      for (const trigger of (skill.triggers || [])) {
        if (trigger instanceof RegExp) {
          if (trigger.test(input)) score += 2;
        } else if (typeof trigger === "string") {
          if (lowerInput.includes(trigger.toLowerCase())) score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestSkill = skill;
      }
    }

    return bestScore > 0 ? bestSkill : null;
  }

  /** Execute a specific skill */
  async execute(skillId, input) {
    const skill = this.skills.get(skillId);
    if (!skill) return null;
    try {
      const result = await skill.execute(input, this.context);
      if (skill.emotion) this.context.emotion.blend(skill.emotion, 0.8);
      return result;
    } catch (err) {
      console.error(`[SkillLoader] Skill ${skillId} failed:`, err);
      return null;
    }
  }

  /** List all registered skills */
  list() {
    return Array.from(this.skills.values()).map(s => ({
      id: s.id, name: s.name, version: s.version, description: s.description
    }));
  }

  /** Remove a skill */
  unregister(skillId) {
    return this.skills.delete(skillId);
  }
}
