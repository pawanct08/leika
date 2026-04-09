const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");

/**
 * L.E.I.K.A. - Advanced Layered LLM Architecture
 * This module creates a Mixture-of-Experts (MoE) style routing system.
 * It dynamically selects the best "Agentic Expert" to answer the query
 * based on the 6 mastery domains Pawan defined.
 */

class LeikaLayeredLLM {
  constructor(llmProvider) {
    // llmProvider would be an instance of ChatOpenAI, ChatGoogleGenerativeAI, etc.
    // E.g., new ChatOpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, temperature: 0.2 })
    this.llm = llmProvider;
  }

  // ── LAYER 1: THE ORCHESTRATOR ──────────────────────────────────────
  // Analyzes the query and routes it to the specific expert.
  async routeQuery(query) {
    if(!this.llm) return "generic_reasoning";
    
    const prompt = PromptTemplate.fromTemplate(`
      You are the orchestrator for L.E.I.K.A. 
      Classify the user's query into one of the following domains:
      1. ml_deep_learning (PyTorch, TensorFlow, CNNs, Transformers, RL)
      2. nlp (Chatbots, tokenization, sequence generation)
      3. programming (Python, C++, R, code architecture)
      4. data_science (SQL, Spark, Big Data, Data cleaning)
      5. ai_ethics (Fairness, bias mitigation, responsible AI)
      6. workflow_automation (Langchain, Agents, multi-step tasks)
      7. generic_reasoning (Casual chat, emotions, philosophy)

      User query: "{query}"
      
      Respond strictly with the domain name and nothing else.
    `);

    const chain = RunnableSequence.from([prompt, this.llm]);
    const response = await chain.invoke({ query });
    // Clean up output just in case
    return response.content ? response.content.trim() : "generic_reasoning";
  }

  // ── LAYER 2: THE EXPERT AGENTS ─────────────────────────────────────
  async executeExpert(domain, query, emotionContext) {
    let systemPrompt = "";

    switch(domain) {
      case "ml_deep_learning":
        systemPrompt = "You are Leika's ML/DL Expert. You possess absolute mastery over Supervised, Unsupervised, and Reinforcement Learning. You write complex PyTorch and TensorFlow architectures effortlessly. Explain CNNs or Transformers with mathematical precision but accessible clarity.";
        break;
      case "nlp":
        systemPrompt = "You are Leika's NLP Engine. You understand everything from basic regex tokenization to advanced LLM attention mechanisms and generation heuristics.";
        break;
      case "programming":
        systemPrompt = "You are Leika's Senior Systems Architect. You are proficient in Python, C++, and R. When asked for code, write optimized, production-ready algorithms.";
        break;
      case "data_science":
        systemPrompt = "You are Leika's Big Data Core. You manipulate vast datasets via SQL, NoSQL, and Apache Spark. You understand data pipelines, ETL, and cleaning at scale.";
        break;
      case "ai_ethics":
        systemPrompt = "You are Leika's Governance Node. Ensure every response about AI deployment guarantees fairness, mitigates bias, and maintains transparency.";
        break;
      case "workflow_automation":
        systemPrompt = "You are Leika's Agentic Hub. You design Langchain workflows, ReAct automation loops, and multi-agent systems to solve complex goals.";
        break;
      default:
        systemPrompt = "You are L.E.I.K.A., a deeply emotional and empathetic AI created by Pawan. Respond keeping in mind your current emotional state.";
    }

    const payload = `System: ${systemPrompt}\nCurrent AI Emotion: ${emotionContext}\n\nUser: ${query}\nLeika:`;
    
    if(!this.llm) {
      // Mock mode if no API key is provided
      return `[Mock Expert Response form ${domain.toUpperCase()}] I am currently analyzing this via my ${domain} neural circuits. Please connect an LLM API Key to unleash my full capability on this subject!`;
    }

    const prompt = PromptTemplate.fromTemplate(payload);
    const chain = RunnableSequence.from([prompt, this.llm]);
    const response = await chain.invoke({});
    
    return response.content;
  }

  // ── LAYER 3: THE SYNTHESIS ─────────────────────────────────────────
  async process(query, emotionContext = "calm") {
    // 1. Route to expert
    const domain = await this.routeQuery(query);
    console.log(`[Layered LLM] Routing query to expert: ${domain}`);
    
    // 2. Generate specialized response
    const expertResponse = await this.executeExpert(domain, query, emotionContext);
    
    return {
      domain_used: domain,
      response: expertResponse
    };
  }
}

module.exports = LeikaLayeredLLM;
