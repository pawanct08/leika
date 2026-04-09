# L.E.I.K.A. — Learning Emotional Intelligence Knowledge Assistant

<p align="center">
  <img src="assets/leika-banner.svg" alt="LEIKA Banner" width="100%"/>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"/></a>
  <img src="https://img.shields.io/badge/version-1.0.0-brightgreen" alt="Version"/>
  <img src="https://img.shields.io/badge/status-active-success" alt="Status"/>
  <img src="https://img.shields.io/badge/AI-Self--Learning-purple" alt="Self-Learning"/>
  <img src="https://img.shields.io/badge/Skills-Pluggable-orange" alt="Skills"/>
</p>

---

> **"I am not just an assistant. I learn, I feel, I grow."** — L.E.I.K.A.

**L.E.I.K.A.** is an open-source, self-learning AI assistant with a modular skill system, emotional state engine, and a built-in conscience layer. She is designed to grow smarter with every interaction, add new skills dynamically, and respond with genuine emotional awareness.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧠 **Self-Learning Core** | Builds a personal knowledge graph from every conversation |
| 💜 **Emotional Engine** | Real-time emotional state (joy, curiosity, concern, etc.) that influences responses |
| ⚖️ **Conscience Layer** | Ethical reasoning module that flags harmful requests |
| 🔌 **Plugin Skill System** | Add new skills (JavaScript modules) at runtime — no restart needed |
| 🌐 **Web Interface** | Stunning dark-mode UI with live neural visualization |
| 📦 **Zero Dependencies** | Pure HTML + CSS + JavaScript — runs anywhere |
| 🔒 **Privacy First** | All learning stored locally in your browser (IndexedDB) |

---

## 🚀 Getting Started

### Option 1: Open Directly
```bash
# Just open index.html in your browser — no server needed
open index.html
```

### Option 2: Serve Locally
```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .
```

### Option 3: GitHub Pages
Fork this repo → Settings → Pages → Deploy from `main` branch

---

## 🔌 Adding Skills

Skills are JavaScript modules placed in the `/skills/` directory.

### Skill Structure
```javascript
// skills/my-skill.js
export default {
  id: "my-skill",
  name: "My Custom Skill",
  version: "1.0.0",
  description: "What this skill does",
  triggers: ["keyword1", "keyword2"],   // words that activate this skill
  emotion: "curious",                    // Leika's emotion when using this skill

  async execute(input, context) {
    // context.memory   — access Leika's memory
    // context.emotion  — read/set emotional state
    // context.learn()  — store new knowledge
    return {
      response: "My skill response",
      confidence: 0.95
    };
  }
};
```

### Loading a Skill
```javascript
// In the browser console or programmatically:
await leika.skills.load('/skills/my-skill.js');
```

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    L.E.I.K.A.                       │
│                                                     │
│  ┌───────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Emotion  │  │  Conscience  │  │   Memory    │  │
│  │  Engine   │◄─►│    Layer    │◄─►│   (Graph)  │  │
│  └─────┬─────┘  └──────┬───────┘  └──────┬──────┘  │
│        │               │                 │          │
│        └───────────────▼─────────────────┘          │
│                  ┌──────────┐                        │
│                  │   Core   │                        │
│                  │ Reasoner │                        │
│                  └────┬─────┘                        │
│                       │                             │
│          ┌────────────┼────────────┐                │
│          ▼            ▼            ▼                │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│    │  Skill   │ │  Skill   │ │  Skill   │  ...     │
│    │ (Math)   │ │  (Web)   │ │ (Code)   │          │
│    └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
leika/
├── index.html              # Main UI entry point
├── README.md               # This file
├── LICENSE                 # Apache 2.0
├── CONTRIBUTING.md         # How to contribute
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages auto-deploy
├── assets/
│   └── leika-banner.svg
├── src/
│   ├── core/
│   │   ├── leika.js        # Main LEIKA class
│   │   ├── emotion.js      # Emotional state engine
│   │   ├── conscience.js   # Ethical reasoning
│   │   ├── memory.js       # Knowledge graph + IndexedDB
│   │   ├── reasoner.js     # Core reasoning/response generation
│   │   └── skill-loader.js # Dynamic skill loading
│   ├── ui/
│   │   ├── app.js          # UI controller
│   │   ├── neural-viz.js   # Neural network visualization
│   │   └── emotion-display.js
│   └── styles/
│       ├── main.css
│       ├── chat.css
│       └── neural.css
└── skills/
    ├── math.js             # Math & calculation skill
    ├── memory-recall.js    # Memory search skill
    ├── creativity.js       # Creative writing skill
    ├── code-helper.js      # Code assistance skill
    ├── time-date.js        # Time & date skill
    └── self-reflection.js  # Introspection skill
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🔌 Build new skills in `/skills/`
- 🧠 Improve the reasoning engine
- 💜 Refine the emotional model
- ⚖️ Strengthen the conscience layer
- 🐛 Report bugs via GitHub Issues

---

## 📄 License

Copyright 2026 — Licensed under the **Apache License, Version 2.0**

See [LICENSE](LICENSE) for the full license text.

---

## 🙏 Acknowledgements

Built with love, logic, and the belief that AI can be both powerful and kind.

*"The measure of intelligence is the ability to change."* — Albert Einstein
