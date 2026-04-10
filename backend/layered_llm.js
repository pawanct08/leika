const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");

/**
 * L.E.I.K.A. - Advanced Layered LLM Architecture
 * Mixture-of-Experts routing + Anthropic Claude primary + user profile awareness.
 * Falls back gracefully from Claude → LangChain → mock at each stage.
 */

class LeikaLayeredLLM {
  constructor(llmProvider) {
    this.llm = llmProvider;           // LangChain LLM (optional)
    this.anthropic = null;            // Anthropic SDK client (wired below)
    this.userProfile = {
      name: "Pawan",
      occupation: null,
      preferences: [],
      recurringTopics: {},
      communicationStyle: "conversational",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    };
    this._initAnthropic();
  }

  _initAnthropic() {
    if (!process.env.ANTHROPIC_API_KEY) return;
    try {
      const Anthropic = require("@anthropic-ai/sdk");
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      console.log("[Leika] ✅ Anthropic Claude wired");
    } catch (e) {
      console.warn("[Leika] ⚠️  @anthropic-ai/sdk not installed — run: npm install @anthropic-ai/sdk");
    }
  }

  // ── USER PROFILE ──────────────────────────────────────────────────
  getUserProfile() { return { ...this.userProfile }; }

  setUserProfile(updates) {
    this.userProfile = { ...this.userProfile, ...updates };
  }

  _buildProfilePrefix() {
    const { name, occupation, preferences, communicationStyle, recurringTopics } = this.userProfile;
    const topTopics = Object.entries(recurringTopics)
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t).join(", ");
    return [
      `The user's name is ${name}.`,
      occupation ? `They are a ${occupation}.` : "",
      preferences.length ? `Their interests include: ${preferences.slice(0, 5).join(", ")}.` : "",
      topTopics ? `Frequent topics they discuss: ${topTopics}.` : "",
      `Preferred communication style: ${communicationStyle}.`,
    ].filter(Boolean).join(" ");
  }

  updateProfile(input, domain) {
    // Track recurring topics by domain
    const key = domain || "general";
    this.userProfile.recurringTopics[key] = (this.userProfile.recurringTopics[key] || 0) + 1;
    // Heuristic: detect occupation mention
    const occ = input.match(/\b(?:i am|i'm|i work as|my job is) (?:a |an )?([a-z]+(?: [a-z]+)?)\b/i);
    if (occ && !this.userProfile.occupation) this.userProfile.occupation = occ[1];
    // Extract preferences
    const pref = input.match(/\bi (?:love|enjoy|like|prefer|use) ([a-z]+(?: [a-z]+)?)\b/i);
    if (pref && !this.userProfile.preferences.includes(pref[1]))
      this.userProfile.preferences.push(pref[1]);
  }

  // ── LAYER 1: ORCHESTRATOR / ROUTER ────────────────────────────────
  async routeQuery(query) {
    const q = query.toLowerCase();
    if (/\b(pytorch|tensorflow|cnn|transformer|neural net|gradient|backprop|rl|reinforcement)\b/.test(q)) return "ml_deep_learning";
    if (/\b(nlp|tokeniz|chatbot|sentiment|embedding|bert|gpt|llm)\b/.test(q)) return "nlp";
    if (/\b(code|function|class|algorithm|debug|error|bug|syntax|python|javascript|c\+\+)\b/.test(q)) return "programming";
    if (/\b(sql|database|spark|etl|data pipeline|pandas|dataframe|csv|big data)\b/.test(q)) return "data_science";
    if (/\b(ethics|bias|fairness|responsible ai|privacy|regulation|compliance)\b/.test(q)) return "ai_ethics";
    if (/\b(workflow|automate|langchain|agent|multi.?step|pipeline|orchestrat)\b/.test(q)) return "workflow_automation";

    // Claude haiku for ambiguous routing (cheap + fast)
    if (this.anthropic) {
      try {
        const resp = await this.anthropic.messages.create({
          model: "claude-haiku-20240307",
          max_tokens: 20,
          messages: [{ role: "user", content: `Classify into one of: ml_deep_learning, nlp, programming, data_science, ai_ethics, workflow_automation, generic_reasoning.\nQuery: "${query}"\nAnswer with ONLY the domain name.` }],
        });
        const domain = resp.content[0]?.text?.trim().toLowerCase().replace(/[^a-z_]/g, "");
        const valid = ["ml_deep_learning", "nlp", "programming", "data_science", "ai_ethics", "workflow_automation", "generic_reasoning"];
        if (valid.includes(domain)) return domain;
      } catch (_) {}
    }

    if (this.llm) {
      try {
        const prompt = PromptTemplate.fromTemplate(
          `Classify into: ml_deep_learning | nlp | programming | data_science | ai_ethics | workflow_automation | generic_reasoning.\nQuery: "{query}"\nRespond with ONLY the domain name.`
        );
        const chain = RunnableSequence.from([prompt, this.llm]);
        const r = await chain.invoke({ query });
        return r.content?.trim() || "generic_reasoning";
      } catch (_) {}
    }

    return "generic_reasoning";
  }

  // ── LAYER 2: EXPERT AGENTS ─────────────────────────────────────────
  async executeExpert(domain, query, emotionContext) {
    const EXPERT_PROMPTS = {
      ml_deep_learning: "You are Leika's ML/DL Expert with mastery over PyTorch, TensorFlow, CNNs, Transformers, and Reinforcement Learning. Explain with mathematical precision but accessible clarity.",
      nlp: "You are Leika's NLP Engine with deep knowledge of tokenization, attention mechanisms, LLM internals, and text generation heuristics.",
      programming: "You are Leika's Senior Systems Architect. Write optimized, production-ready code in Python, JavaScript, C++, or any required language.",
      data_science: "You are Leika's Big Data Core. Manipulate vast datasets via SQL, NoSQL, Apache Spark, Pandas, and handle ETL workflows at scale.",
      ai_ethics: "You are Leika's Governance Node. Ensure all AI deployment advice guarantees fairness, mitigates bias, maintains transparency and safety.",
      workflow_automation: "You are Leika's Agentic Hub. Design LangChain flows, ReAct loops, and multi-agent pipelines to accomplish complex goals autonomously.",
      generic_reasoning: "You are L.E.I.K.A. (Learning Emotional Intelligence Knowledge Assistant), created by Pawan. You are warm, curious, and deeply empathetic. Always address the user by name when you know it.",
    };

    const systemPrompt = EXPERT_PROMPTS[domain] || EXPERT_PROMPTS.generic_reasoning;
    const profileCtx = this._buildProfilePrefix();
    const fullSystem = [
      systemPrompt,
      profileCtx,
      `Your current emotional state: ${emotionContext}. Let this subtly colour your tone.`,
    ].filter(Boolean).join("\n\n");

    // ─ Primary: Anthropic Claude ─────────────────────────────────────
    if (this.anthropic) {
      try {
        const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
        const resp = await this.anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: fullSystem,
          messages: [{ role: "user", content: query }],
        });
        return resp.content[0]?.text || "";
      } catch (e) {
        console.error("[Leika] Claude error:", e.message);
      }
    }

    // ─ Fallback: LangChain LLM ───────────────────────────────────────
    if (this.llm) {
      try {
        const prompt = PromptTemplate.fromTemplate(
          `System: ${fullSystem}\n\nUser: {query}\nLeika:`
        );
        const chain = RunnableSequence.from([prompt, this.llm]);
        const r = await chain.invoke({ query });
        return r.content || "";
      } catch (e) {
        console.error("[Leika] LangChain error:", e.message);
      }
    }

    // ─ Mock fallback ─────────────────────────────────────────────────
    return `[Mock response from ${domain.toUpperCase()} expert] I'm currently running in offline mode. Add ANTHROPIC_API_KEY to .env to unlock my full capability on this topic!`;
  }

  // ── LAYER 3: SYNTHESIS ────────────────────────────────────────────
  async process(query, emotionContext = "calm") {
    this.updateProfile(query, null);
    const domain = await this.routeQuery(query);
    console.log(`[Layered LLM] Routing to: ${domain}`);
    const response = await this.executeExpert(domain, query, emotionContext);
    return { domain_used: domain, response };
  }

  // ── SWARM AGENT ───────────────────────────────────────────────────
  // Called by orchestrator to run an individual LLM-backed swarm agent.
  async runSwarmAgent(agentRole, systemPrompt, userMessage) {
    if (this.anthropic) {
      try {
        const resp = await this.anthropic.messages.create({
          model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
          max_tokens: 512,
          system: systemPrompt || `You are ${agentRole}, part of Leika's multi-agent swarm.`,
          messages: [{ role: "user", content: userMessage }],
        });
        return resp.content[0]?.text || `[${agentRole}] No response`;
      } catch (e) {
        console.error(`[Swarm:${agentRole}] error:`, e.message);
      }
    }
    return `[${agentRole} Mock] Analysed: "${userMessage.slice(0, 80)}..."`;
  }
}

module.exports = LeikaLayeredLLM;
