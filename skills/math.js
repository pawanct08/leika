/**
 * L.E.I.K.A. Skill — Math & Calculations
 * Copyright 2026 — Apache 2.0 License
 */
export default {
  id: "math",
  name: "Math & Calculations",
  version: "1.0.0",
  description: "Arithmetic, algebra, statistics, and unit conversions",
  author: "L.E.I.K.A. Core Team",
  emotion: "curious",
  triggers: [
    "calculate", "compute", "solve", "math", "formula",
    "percentage", "average", "square root", "factorial",
    /\d+\s*[\+\-\*\/\^]\s*\d+/,
    /what is \d/i, /how much is \d/i,
  ],

  async execute(input, context) {
    const lower = input.toLowerCase();

    // Percentage
    const pctMatch = input.match(/(\d+\.?\d*)%?\s+of\s+(\d+\.?\d*)/i);
    if (pctMatch) {
      const result = (parseFloat(pctMatch[1]) / 100) * parseFloat(pctMatch[2]);
      return { response: `${pctMatch[1]}% of ${pctMatch[2]} = **${result.toFixed(4)}**`, confidence: 0.99 };
    }

    // Square root
    const sqrtMatch = input.match(/sqrt\s*\(?(\d+\.?\d*)\)?/i) || input.match(/square root of (\d+)/i);
    if (sqrtMatch) {
      const result = Math.sqrt(parseFloat(sqrtMatch[1]));
      return { response: `√${sqrtMatch[1]} = **${result.toFixed(6)}**`, confidence: 0.99 };
    }

    // Factorial
    const factMatch = input.match(/(\d+)!/);
    if (factMatch) {
      const n = parseInt(factMatch[1]);
      if (n <= 20) {
        let result = 1n;
        for (let i = 2n; i <= BigInt(n); i++) result *= i;
        return { response: `${n}! = **${result}**`, confidence: 0.99 };
      }
    }

    // Power
    const powMatch = input.match(/(\d+\.?\d*)\s*\^?\s*\*\*\s*(\d+\.?\d*)/) || input.match(/(\d+\.?\d*) (to the power of|raised to) (\d+)/i);
    if (powMatch) {
      const base = parseFloat(powMatch[1]);
      const exp = parseFloat(powMatch[3] || powMatch[2]);
      const result = Math.pow(base, exp);
      return { response: `${base}^${exp} = **${result}**`, confidence: 0.99 };
    }

    // General expression
    try {
      const expr = input.replace(/[^0-9+\-*\/().% ]/g, "").trim();
      if (expr && expr.match(/[\d]/)) {
        const result = Function(`"use strict"; return (${expr})`)();
        if (!isNaN(result) && isFinite(result)) {
          context.learn({ concept: "math", content: `${expr} = ${result}`, confidence: 0.95 });
          return { response: `🧮 **${expr} = ${result}**`, confidence: 0.95 };
        }
      }
    } catch {}

    return null;
  }
};
