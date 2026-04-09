export default {
  id: "wikipedia",
  name: "Global Knowledge (Web Search)",
  version: "1.0.0",
  description: "Fetches real-time knowledge from Wikipedia to supplement Leika's memory dynamically.",
  
  // Triggers when user asks factual "who", "what is", or specifically asks to search.
  triggers: [
    /^(who is|what is|what are|explain|tell me about) /i,
    /search (the web|wikipedia|internet) for /i
  ],

  emotion: "curious",

  async execute(input, context) {
    // Extract query
    let query = input.replace(/^(who is|what is|what are|explain|tell me about|search the web for|search wikipedia for|search internet for)/i, "").trim();
    // Remove punctuation
    query = query.replace(/[?.,!]/g, "");
    
    if (!query) return null;

    try {
      // Hit Wikipedia API (CORS friendly, no key needed)
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(query)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      
      if (pageId === "-1" || !pages[pageId].extract) {
        return null; // Let the normal reasoner / local memory handle it
      }

      const extract = pages[pageId].extract;
      
      // We don't want to spit back a massive article.
      const snippet = extract.split('. ').slice(0, 3).join('. ') + '.';

      // Inject this massive new fact into her local Neural Schema subconsciously!
      context.learn({
        concept: query,
        content: snippet,
        confidence: 0.9,
        source: "wikipedia"
      });

      return {
        response: `Based on the global archives, here is what I found about ${query}: \n\n> *${snippet}*\n\nI have now committed this to my neural scheme for the future. Is there an aspect of this you'd like to explore?`,
        confidence: 0.9,
        emotion: "curious"
      };

    } catch(e) {
      console.warn("Wikipedia fetch failed:", e);
      return null;
    }
  }
};
