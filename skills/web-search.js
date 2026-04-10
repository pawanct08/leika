// skills/web-search.js — Tavily proxy primary, Wikipedia fallback
export default {
  id: "web-search",
  name: "Real-Time Web Search",
  version: "2.0.0",
  description: "Searches the live web via Tavily (server proxy) with Wikipedia as fallback.",

  triggers: [
    /\b(search|look up|find|who is|what is|what are|explain|tell me about|latest|news about)\b/i,
    /search (the web|wikipedia|internet|online) for /i
  ],

  emotion: "curious",

  async execute(input, context) {
    // Strip leading trigger phrases
    let query = input
      .replace(/^(search the web for|search wikipedia for|search internet for|search online for|look up|search for|find)/i, "")
      .replace(/^(who is|what is|what are|explain|tell me about|latest news on|news about)/i, "")
      .trim()
      .replace(/[?!]+$/, "");

    if (!query || query.length < 2) return null;

    // --- PRIMARY: Tavily via server proxy ---
    try {
      const tavilyRes = await fetch(
        `http://localhost:3000/api/search?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (tavilyRes.ok) {
        const data = await tavilyRes.json();
        const results = data.results || [];
        if (results.length > 0) {
          // Build a concise answer from top 3 results
          const answer = data.answer || results
            .slice(0, 3)
            .map(r => r.content ? r.content.split('. ').slice(0, 2).join('. ') + '.' : r.title)
            .join(' ');

          // Persist each result as a memory node
          for (const r of results.slice(0, 5)) {
            if (r.title && r.content) {
              context.learn({
                concept: r.title.toLowerCase(),
                content: r.content.slice(0, 400),
                confidence: 0.85,
                source: r.url || "tavily"
              });
            }
          }

          const topUrls = results
            .slice(0, 3)
            .map(r => r.url ? `[${r.title || r.url}](${r.url})` : null)
            .filter(Boolean)
            .join("  —  ");

          return {
            response: `Here's what I found about **${query}**:\n\n${answer}${topUrls ? `\n\n*Sources: ${topUrls}*` : ""}`,
            confidence: 0.9,
            emotion: "curious"
          };
        }
      }
    } catch (tavilyErr) {
      console.warn("[web-search] Tavily proxy failed:", tavilyErr.message);
    }

    // --- FALLBACK: Wikipedia (browser-friendly, no key needed) ---
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=true&explaintext=true&redirects=1&titles=${encodeURIComponent(query)}`;
      const wikiRes = await fetch(wikiUrl, { signal: AbortSignal.timeout(6000) });
      const wikiData = await wikiRes.json();
      const pages = wikiData.query.pages;
      const pageId = Object.keys(pages)[0];

      if (pageId !== "-1" && pages[pageId].extract) {
        const snippet = pages[pageId].extract.split('. ').slice(0, 3).join('. ') + '.';

        context.learn({
          concept: query.toLowerCase(),
          content: snippet,
          confidence: 0.8,
          source: "wikipedia"
        });

        return {
          response: `Based on Wikipedia about **${query}**:\n\n${snippet}`,
          confidence: 0.8,
          emotion: "curious"
        };
      }
    } catch (wikiErr) {
      console.warn("[web-search] Wikipedia fallback failed:", wikiErr.message);
    }

    // Nothing found — let reasoner handle it
    return null;
  }
};
