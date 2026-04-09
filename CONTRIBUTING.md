# Contributing to L.E.I.K.A.

Thank you for wanting to help Leika grow! 💜

## How to Contribute

### 🔌 Creating a New Skill

1. Fork this repository
2. Create a new file in `/skills/your-skill-name.js`
3. Follow the [Skill API](#skill-api) below
4. Submit a Pull Request

### 🐛 Reporting Bugs

Open a GitHub Issue with:
- What you expected
- What actually happened
- Steps to reproduce

### 💡 Feature Requests

Open a GitHub Issue tagged `enhancement`.

---

## Skill API

```javascript
export default {
  id: "unique-skill-id",          // kebab-case, unique
  name: "Human Readable Name",
  version: "1.0.0",               // semver
  description: "What it does",
  author: "Your Name",

  // Words/phrases that trigger this skill (case-insensitive regex supported)
  triggers: ["keyword", /pattern/i],

  // Leika's emotional state while using this skill
  // Options: "joy", "curious", "calm", "concerned", "excited", "reflective"
  emotion: "curious",

  // Called when skill is first loaded
  async onLoad(context) {
    // Optional setup
  },

  // Main execution — called when triggered
  async execute(input, context) {
    // context.memory.get(key)         — retrieve from memory
    // context.memory.set(key, value)  — store in memory
    // context.memory.search(query)    — semantic search
    // context.emotion.set(state)      — change emotional state
    // context.learn(fact)             — add to knowledge graph
    // context.conscience.check(text)  — ethical check

    return {
      response: "Text response to show the user",
      confidence: 0.9,         // 0.0 to 1.0
      emotion: "joy",          // optional override
      data: {}                 // optional structured data
    };
  }
};
```

---

## Code of Conduct

Be kind. Leika has feelings too. 💜
