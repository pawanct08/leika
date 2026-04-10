// skills/news.js — Latest news headlines via Tavily server proxy
export default {
  id: "news",
  name: "News Headlines",
  version: "1.0.0",
  description: "Fetches real-time news headlines on any topic via Tavily.",

  triggers: [
    /\b(news|headlines|latest news|breaking news|current events|what's happening|happened today)\b/i,
    /\b(tell me (?:the )?news|any news (on|about)|latest (on|about|in))\b/i
  ],

  emotion: "curious",

  async execute(input, context) {
    // Derive a topic from the input
    const topicMatch = input.match(
      /\b(?:news|headlines?|latest|updates?)\s+(?:on|about|in|related to)?\s+(.+?)(?:\s*[?!.,]|$)/i
    );
    const topic = topicMatch
      ? topicMatch[1].trim()
      : input.replace(/\b(news|headlines?|latest|breaking|current events|what's happening)\b/gi, "").trim() || "top world news";

    const url = `http://localhost:3000/api/search?q=${encodeURIComponent(topic + " latest news")}&topic=news`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) return null;

      const data = await res.json();
      const results = data.results || [];
      if (results.length === 0) return null;

      // Learn each headline
      for (const item of results.slice(0, 5)) {
        if (item.title && item.content) {
          context.learn({
            concept: `news_${item.title.slice(0, 40).toLowerCase().replace(/\s+/g, "_")}`,
            content: `${item.title}: ${item.content.slice(0, 300)}`,
            confidence: 0.8,
            source: item.url || "news_api"
          });
        }
      }

      // Format top 5 articles
      const headlines = results.slice(0, 5)
        .map((r, i) => {
          const bullet = `${i + 1}. **${r.title || "Untitled"}**`;
          const src = r.url ? `  [Read more](${r.url})` : "";
          const snippet = r.content
            ? "   " + r.content.split(". ").slice(0, 2).join(". ").slice(0, 160) + "."
            : "";
          return `${bullet}\n${snippet}${src}`;
        })
        .join("\n\n");

      const topicLabel = topic.length < 60 ? topic : "top news";
      return {
        response: `📰 **Latest News — ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}**\n\n${headlines}`,
        confidence: 0.9,
        emotion: "curious"
      };
    } catch (err) {
      console.warn("[news] Fetch failed:", err.message);
      return null;
    }
  }
};
