const { z } = require("zod");
const fs = require("fs").promises;
const nodePath = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// Safety blocklist for shell_execute
const SHELL_BLOCKLIST = [
  /rm\s+-rf/i, /format\s+[a-z]:/i, /del\s+\/[sf]/i,
  /shutdown/i, /rmdir\s+\/s/i, /:(){ :|:& };:/
];

/**
 * LeikaSwarm — LLM-backed agent for parallel pipeline tasks
 */
class LeikaSwarm {
  constructor(name, permissions = [], llm = null) {
    this.name = name;
    this.permissions = new Set(permissions);
    this.status = "idle";
    this.llm = llm;
  }

  async executeTask(task, context = "") {
    this.status = "working";
    console.log(`[Swarm: ${this.name}] Executing: ${task.slice(0, 80)}`);
    let result;
    if (this.llm) {
      try {
        result = await this.llm.runSwarmAgent(
          this.name,
          `You are ${this.name}. Perform your role concisely and accurately.`,
          context ? `Task: ${task}\nContext:\n${context}` : `Task: ${task}`
        );
      } catch (e) {
        result = `[${this.name}] Error: ${e.message}`;
      }
    } else {
      result = `[${this.name} Mock] Processed: "${task.slice(0, 80)}..."` ;
    }
    this.status = "idle";
    return { agent: this.name, result, timestamp: Date.now() };
  }
}

/**
 * Orchestrator — central coordinator: tools, swarm agents, research pipelines
 */
class Orchestrator {
  constructor() {
    this.agents = new Map();
    this.tools = new Map();
    this.llm = null;
    this._registerDefaultTools();
  }

  /** Wire the LLM after server instantiation */
  setLLM(llm) {
    this.llm = llm;
    console.log("[Orchestrator] LLM wired to swarm agents");
  }

  // ── Tool Registry ───────────────────────────────────────────────────────

  registerTool(name, schema, fn) {
    this.tools.set(name, { schema, execute: fn });
  }

  async callTool(name, input) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool '${name}' not found`);
    const validated = tool.schema.parse(input);
    return await tool.execute(validated);
  }

  _registerDefaultTools() {
    // file_read
    this.registerTool(
      "file_read",
      z.object({ path: z.string(), encoding: z.string().default("utf-8") }),
      async ({ path: filePath, encoding }) => {
        const abs = nodePath.resolve(filePath);
        const content = await fs.readFile(abs, encoding);
        return { path: abs, content, size: content.length };
      }
    );

    // directory_list
    this.registerTool(
      "directory_list",
      z.object({ path: z.string() }),
      async ({ path: dirPath }) => {
        const abs = nodePath.resolve(dirPath);
        const entries = await fs.readdir(abs, { withFileTypes: true });
        return entries.map(e => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" }));
      }
    );

    // file_write
    this.registerTool(
      "file_write",
      z.object({ path: z.string(), content: z.string(), encoding: z.string().default("utf-8") }),
      async ({ path: filePath, content, encoding }) => {
        const abs = nodePath.resolve(filePath);
        await fs.writeFile(abs, content, encoding);
        return { path: abs, written: content.length };
      }
    );

    // shell_execute (gated)
    this.registerTool(
      "shell_execute",
      z.object({ command: z.string(), cwd: z.string().optional() }),
      async ({ command, cwd }) => {
        for (const pattern of SHELL_BLOCKLIST) {
          if (pattern.test(command)) throw new Error(`Blocked dangerous command: ${command}`);
        }
        const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd(), timeout: 10000 });
        return { stdout: stdout.trim(), stderr: stderr.trim() };
      }
    );

    // web_fetch
    this.registerTool(
      "web_fetch",
      z.object({ url: z.string().url(), timeout: z.number().default(8000) }),
      async ({ url, timeout }) => {
        const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const r = await fetch(url, { signal: controller.signal });
          clearTimeout(id);
          const text = await r.text();
          return { url, status: r.status, content: text.slice(0, 4000) };
        } catch (e) { clearTimeout(id); throw e; }
      }
    );
  }

  // ── Swarm Management ────────────────────────────────────────────────────

  spawnSwarm(name, permissions = []) {
    const agent = new LeikaSwarm(name, permissions, this.llm);
    this.agents.set(name, agent);
    return agent;
  }

  async runParallel(tasks) {
    console.log(`[Orchestrator] Spawning ${tasks.length} parallel agents...`);
    const promises = tasks.map((t, i) => {
      const agent = this.spawnSwarm(`SubAgent-${i}`, t.permissions || []);
      return agent.executeTask(t.description, t.data || "");
    });
    return await Promise.all(promises);
  }

  // ── 4-Agent Research Pipeline ──────────────────────────────────────────

  async researchAndReport(topic) {
    console.log(`[Orchestrator] 4-agent research pipeline: "${topic}"`);

    const researcher = this.spawnSwarm("Researcher", ["read", "web"]);
    const analyst   = this.spawnSwarm("Analyst",    ["read"]);
    const writer    = this.spawnSwarm("Writer",     ["read"]);
    const critic    = this.spawnSwarm("Critic",     ["read"]);

    const research  = await researcher.executeTask(`Research the topic: "${topic}". List key facts, data, and context.`, "");
    const analysis  = await analyst.executeTask(`Analyse and identify patterns, insights, and implications for: "${topic}"`, research.result);
    const draft     = await writer.executeTask(`Write a clear, structured report on: "${topic}"`, analysis.result);
    const final     = await critic.executeTask(`Review and improve this report on "${topic}". Return the polished final version.`, draft.result);

    return final.result;
  }
}

const leikaOrchestrator = new Orchestrator();

module.exports = leikaOrchestrator;
