const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");

/**
 * L.E.I.K.A. - Advanced Layered LLM Architecture
 * Mixture-of-Experts routing + Anthropic Claude primary + user profile awareness.
 * Falls back gracefully from Claude → LangChain → mock at each stage.
 */

// ── MoE Adapter Registry ────────────────────────────────────────────────────
// Maps each expertise domain → the LoRA adapter and base model that should
// serve it when USE_LOCAL_MODEL=true + OLLAMA_URL are configured in .env.
// Each adapter is a LoRA fine-tune loaded on top of the specified base model.
const MoE_ADAPTER_REGISTRY = {
  ml_deep_learning:    { adapter: 'leika-ml-lora-v1',     baseModel: 'llama3.1:8b',   temp: 0.3 },
  nlp:                 { adapter: 'leika-nlp-lora-v1',    baseModel: 'llama3.1:8b',   temp: 0.4 },
  programming:         { adapter: 'leika-code-lora-v1',   baseModel: 'codellama:13b', temp: 0.1 },
  data_science:        { adapter: 'leika-data-lora-v1',   baseModel: 'llama3.1:8b',   temp: 0.2 },
  ai_ethics:           { adapter: 'leika-ethics-lora-v1', baseModel: 'llama3.1:8b',   temp: 0.5 },
  workflow_automation: { adapter: 'leika-agent-lora-v1',  baseModel: 'llama3.1:8b',   temp: 0.4 },
  generic_reasoning:   { adapter: 'leika-core-lora-v1',   baseModel: 'llama3.1:8b',   temp: 0.7 },
};

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
  async executeExpert(domain, query, emotionContext, ragContext = '') {
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

    // Augment query with RAG-retrieved context (long-term memory injection)
    const augmentedQuery = ragContext ? `${ragContext}\n\nUser question: ${query}` : query;

    // Chain-of-Thought: enabled for analytical domains unless disabled in env
    const COT_DOMAINS = new Set(['ml_deep_learning', 'programming', 'ai_ethics', 'workflow_automation', 'data_science']);
    const useCoT = process.env.CHAIN_OF_THOUGHT !== 'false' && COT_DOMAINS.has(domain);

    // ─ Primary: Anthropic Claude ─────────────────────────────────────
    if (this.anthropic) {
      try {
        const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
        if (useCoT) {
          return await this._chainOfThought(fullSystem, augmentedQuery, model);
        }
        const resp = await this.anthropic.messages.create({
          model,
          max_tokens: 1024,
          system: fullSystem,
          messages: [{ role: "user", content: augmentedQuery }],
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
        const r = await chain.invoke({ query: augmentedQuery });
        return r.content || "";
      } catch (e) {
        console.error("[Leika] LangChain error:", e.message);
      }
    }

    // ─ Mock fallback ─────────────────────────────────────────────────
    return `[Mock response from ${domain.toUpperCase()} expert] I'm currently running in offline mode. Add ANTHROPIC_API_KEY to .env to unlock my full capability on this topic!`;
  }

  // ── Chain-of-Thought: two-pass hidden reasoning ──────────────────────────
  // Pass 1 (scratchpad): model reasons without answer pressure → richer analysis
  // Pass 2 (synthesis):  final answer conditioned on the reasoning → higher accuracy
  // Net result: substantially better performance on multi-step analytical tasks.
  async _chainOfThought(systemPrompt, query, model) {
    const thinkingSystem = systemPrompt +
      "\n\nBefore answering, reason through the problem carefully in a private scratchpad. " +
      "Be thorough and consider edge cases.";

    // Pass 1: generate scratchpad reasoning
    let reasoning = '';
    try {
      const thinkResp = await this.anthropic.messages.create({
        model,
        max_tokens: 600,
        system: thinkingSystem,
        messages: [{ role: "user", content: `Think through this carefully: ${query}` }],
      });
      reasoning = thinkResp.content[0]?.text || '';
    } catch (e) {
      console.warn("[CoT] Reasoning pass failed — direct answer:", e.message);
      const direct = await this.anthropic.messages.create({
        model, max_tokens: 1024, system: systemPrompt,
        messages: [{ role: "user", content: query }],
      });
      return direct.content[0]?.text || '';
    }

    // Pass 2: final response conditioned on the scratchpad reasoning
    const resp = await this.anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: "user",      content: query },
        { role: "assistant", content: `<reasoning>\n${reasoning}\n</reasoning>\n\nBased on my analysis:` },
      ],
    });
    return resp.content[0]?.text || reasoning;
  }

  // ── LAYER 3: SYNTHESIS ────────────────────────────────────────────
  async process(query, emotionContext = "calm", ragContext = '') {
    this.updateProfile(query, null);
    const domain = await this.routeQuery(query);
    console.log(`[Layered LLM] Routing to: ${domain}`);
    const adapterConfig = MoE_ADAPTER_REGISTRY[domain] || MoE_ADAPTER_REGISTRY.generic_reasoning;
    console.log(`[MoE] Adapter: ${adapterConfig.adapter} on ${adapterConfig.baseModel}`);
    const response = await this.executeExpert(domain, query, emotionContext, ragContext);
    return { domain_used: domain, response, adapter: adapterConfig.adapter };
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
