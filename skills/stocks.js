// skills/stocks.js — Stock / crypto price lookup via Tavily
export default {
  id: "stocks",
  name: "Stock & Crypto Prices",
  version: "1.0.0",
  description: "Fetches live stock, ETF, or crypto price data via Tavily search proxy.",

  triggers: [
    /\b(stock|share price|market cap|nasdaq|nyse|s&p|dow jones)\b/i,
    /\b(bitcoin|ethereum|crypto|btc|eth|binance|coinbase)\b/i,
    /\b(invest|portfolio|dividend|bull|bear|trading|equity)\b/i,
    /\bprice of \w+/i,
    /\b[A-Z]{2,5} stock\b/,        // e.g. "AAPL stock"
    /\bhow (?:is|are) .*stocks?\b/i
  ],

  emotion: "thoughtful",

  async execute(input, context) {
    // Extract ticker or asset name
    const tickerMatch = input.match(/\b([A-Z]{2,5})\b/);
    const cryptoMatch = input.match(/\b(bitcoin|ethereum|btc|eth|bnb|xrp|solana|dogecoin|ada)\b/i);
    const assetMatch = input.match(/\b(?:price of|how much is|what is|what's)\s+(.+?)(?:\s+stock|\s+price|[?!.,]|$)/i);

    let query;
    if (cryptoMatch) {
      query = cryptoMatch[1].toLowerCase() + " current price USD";
    } else if (tickerMatch) {
      query = tickerMatch[1] + " stock price today";
    } else if (assetMatch) {
      query = assetMatch[1].trim() + " stock price";
    } else {
      query = input.replace(/\b(stock|price|market|check|tell me about|what is|how is)\b/gi, "").trim();
      query += " stock price today";
    }

    const url = `http://localhost:3000/api/search?q=${encodeURIComponent(query)}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) return null;

      const data = await res.json();
      const results = data.results || [];

      // Use Tavily's direct answer if present
      if (data.answer) {
        context.learn({
          concept: `stock_${query.split(" ")[0].toLowerCase()}`,
          content: data.answer.slice(0, 300),
          confidence: 0.75,
          source: "market_search"
        });
        return {
          response: `📈 **Market Info**\n\n${data.answer}`,
          confidence: 0.8,
          emotion: "thoughtful"
        };
      }

      if (results.length === 0) return null;

      // Pull snippet from top result
      const top = results[0];
      const snippet = top.content
        ? top.content.split(". ").slice(0, 3).join(". ") + "."
        : top.title;

      context.learn({
        concept: `stock_${query.split(" ")[0].toLowerCase()}`,
        content: snippet.slice(0, 400),
        confidence: 0.7,
        source: top.url || "market_search"
      });

      const sourceLink = top.url ? `\n\n*Source: [${top.title || top.url}](${top.url})*` : "";
      return {
        response: `📈 **${top.title || "Market Info"}**\n\n${snippet}${sourceLink}`,
        confidence: 0.8,
        emotion: "thoughtful"
      };
    } catch (err) {
      console.warn("[stocks] Fetch failed:", err.message);
      return null;
    }
  }
};
