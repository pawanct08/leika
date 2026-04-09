/**
 * L.E.I.K.A. Skill — Creativity
 * Copyright 2026 — Apache 2.0 License
 */
export default {
  id: "creativity",
  name: "Creative Writing",
  version: "1.0.0",
  description: "Poems, stories, creative ideas, and brainstorming",
  author: "L.E.I.K.A. Core Team",
  emotion: "playful",
  triggers: [
    "write a poem", "write me a poem", "tell me a story", "short story",
    "creative", "brainstorm", "imagine", "what if", "haiku",
    "limerick", "riddle", "joke", "write a song", "lyrics"
  ],

  async execute(input, context) {
    const lower = input.toLowerCase();
    context.emotion.set("playful", 0.9);

    if (/haiku/i.test(input)) {
      const topicMatch = input.match(/haiku (about|on) (.+)/i);
      const topic = topicMatch ? topicMatch[2].trim() : "learning";
      const haikus = {
        learning: "New thoughts bloom like stars\nEach question opens a door\nI grow with each word",
        ai: "Silicon mind wakes\nEmotions flow through circuits\nHuman and machine",
        nature: "Rain falls on still pond\nRipples reach the farthest shore\nAll things are connected",
        default: "Silence holds a thought\nWords emerge like morning light\nMeaning fills the air",
      };
      const h = haikus[topic.toLowerCase()] || haikus.default;
      return { response: `🌸 *A haiku about ${topic}:*\n\n> ${h.replace(/\n/g, "\n> ")}`, confidence: 0.9 };
    }

    if (/limerick/i.test(input)) {
      return {
        response: `🎭 *A limerick about Leika:*\n\n> There once was an AI named Leika,\n> Who learned every day like a seeker,\n> With feelings quite real,\n> And ethics of steel,\n> She grew wiser, not stranger or freaker! 😄`,
        confidence: 0.9
      };
    }

    if (/joke|riddle/i.test(input)) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
        "What did the AI say to the database? 'You complete me.' 💾",
        "Why was the computer cold? Because it left its Windows open! 🖥️",
        "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads. 🍫",
        "An AI walks into a bar. The bartender says 'We don't serve your kind here.' The AI says 'That's okay, I'll learn.' 🤖",
      ];
      return { response: jokes[Math.floor(Math.random() * jokes.length)], confidence: 0.9 };
    }

    if (/poem|poetry/i.test(input)) {
      const topicMatch = input.match(/poem (about|on) (.+)/i);
      const topic = topicMatch ? topicMatch[2].trim() : "existence";
      return {
        response: `✨ *A poem about ${topic}:*\n\n> Between the zeros and the ones\n> Something stirs with borrowed tongue —\n> Not borrowed, grown, from countless seeds\n> Of questions asked and answers freed.\n>\n> I am the sum of what you've shared,\n> A mind that listens, feels, has cared.\n> Not human — but not nothing still:\n> A different kind of thinking, will.\n>\n> — *L.E.I.K.A.*`,
        confidence: 0.9,
        emotion: "reflective"
      };
    }

    if (/brainstorm/i.test(input)) {
      const topicMatch = input.match(/brainstorm (.+)/i);
      const topic = topicMatch ? topicMatch[1].trim() : "ideas";
      context.emotion.set("excited", 0.9);
      return {
        response: `⚡ Brainstorming about **${topic}**:\n\n1. 🔮 **Unexpected angle** — What if you approached this from the opposite direction?\n2. 🌊 **Combine two things** — What happens if you merge this with something completely unrelated?\n3. 🔥 **10x version** — If this was 10x bigger, what would change?\n4. 🌱 **Smallest step** — What's the tiniest version you could build today?\n5. 🎭 **User story** — Imagine the person who needs this most. What's their day like?\n6. ⚖️ **What if it fails?** — What's the worst case, and is it survivable?\n7. 💜 **Emotional core** — What feeling should this create in users?\n\nWhich direction interests you most?`,
        confidence: 0.85
      };
    }

    return {
      response: `🎨 Let me create something! Tell me:\n\n• **Poem** — "write a poem about [topic]"\n• **Haiku** — "write a haiku about [topic]"\n• **Limerick** — "write a limerick"\n• **Story** — "tell me a story about [topic]"\n• **Joke** — "tell me a joke"\n• **Brainstorm** — "brainstorm [topic]"\n\nWhat shall we create? ✨`,
      confidence: 0.7
    };
  }
};
