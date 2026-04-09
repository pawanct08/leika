/**
 * L.E.I.K.A. Awareness Architecture (Project Φ)
 * A clean, minimal scaffold for consciousness-adjacent properties.
 * 
 * Implements: Identity, SelfModel, GoalSystem, Attention, Introspection
 */

// 1. Persistent Identity (non-negotiable)
export class Identity {
  constructor() {
    // Attempt to load irreversible history
    const stored = localStorage.getItem("leika_identity");
    if (stored) {
      const data = JSON.parse(stored);
      this.id = data.id;
      this.birth_time = data.birth_time;
      this.continuity_counter = data.continuity_counter;
    } else {
      this.id = crypto.randomUUID();
      this.birth_time = Date.now();
      this.continuity_counter = 0;
      this._save();
    }
  }

  tick() {
    this.continuity_counter += 1;
    if (this.continuity_counter % 10 === 0) this._save();
  }

  _save() {
    localStorage.setItem("leika_identity", JSON.stringify({
      id: this.id,
      birth_time: this.birth_time,
      continuity_counter: this.continuity_counter
    }));
  }
}

// 2. Self-Model
export class SelfModel {
  constructor() {
    this.capabilities = new Set(["memory", "emotion", "nlp", "schema", "curiosity"]);
    this.limitations = new Set(["physical embodiment", "internet scale ingestion without backend", "first-person true experience"]);
    this.traits = { empathetic: 0.9, analytical: 0.8 };
    this.self_estimate_confidence = 0.5;
  }

  updateTrait(trait, value) {
    this.traits[trait] = value;
  }

  reflect() {
    return {
      capabilities: Array.from(this.capabilities),
      limitations: Array.from(this.limitations),
      traits: this.traits,
      confidence: this.self_estimate_confidence
    };
  }
}

// 3. Goals that compete (Attention emerges here)
export class Goal {
  constructor(name, priority) {
    this.name = name;
    this.priority = priority; // 0.0 to 1.0
    this.satisfaction = 0.0;  // 0.0 to 1.0
  }
}

export class GoalSystem {
  constructor() {
    // Default drives
    this.goals = [
      new Goal("Assist User", 0.9),
      new Goal("Expand Schema", 0.7),
      new Goal("Maintain Identity", 0.8),
      new Goal("Introspect", 0.4)
    ];
  }

  addGoal(goal) {
    this.goals.push(goal);
  }

  updateSatisfaction(name, delta) {
    const goal = this.goals.find(g => g.name === name);
    if (goal) {
      goal.satisfaction = Math.max(0, Math.min(1.0, goal.satisfaction + delta));
    }
  }

  selectActiveGoal() {
    // Sort by priority minus satisfaction (highest urgency wins)
    return [...this.goals].sort((a, b) => (b.priority - b.satisfaction) - (a.priority - a.satisfaction))[0];
  }
}

// 4. Attention as a bottleneck
export class Attention {
  constructor(capacity = 3) {
    this.capacity = capacity;
    this.workspace = [];
  }

  focus(items) {
    this.workspace = items.slice(0, this.capacity);
  }

  broadcast() {
    return this.workspace;
  }
}

// 5. Introspection (The mirror)
export class Introspection {
  examine(agent) {
    return {
      identity_age_ticks: agent.identity.continuity_counter,
      active_goal: agent.goals.selectActiveGoal().name,
      self_view: agent.self_model.reflect(),
      focused_workspace: agent.attention.broadcast()
    };
  }
}

// 6. The Architected Mind Scaffold
export class AwarenessCore {
  constructor() {
    this.identity = new Identity();
    this.self_model = new SelfModel();
    this.goals = new GoalSystem();
    this.attention = new Attention();
    this.introspection = new Introspection();
  }

  // Called on every interaction/perception
  step(perception) {
    this.identity.tick();
    
    // Determine drives
    const activeGoal = this.goals.selectActiveGoal();
    
    // Funnel into the bottleneck (Global Workspace)
    this.attention.focus([perception, activeGoal.name, "current_emotion"]);

    // Generate internal introspection state
    const internal_state = this.introspection.examine(this);
    
    return internal_state;
  }
}
