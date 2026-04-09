/**
 * L.E.I.K.A. Skill — Code Helper
 * Copyright 2026 — Apache 2.0 License
 */
export default {
  id: "code-helper",
  name: "Code Assistant",
  version: "1.0.0",
  description: "Code explanations, snippets, debugging tips, and programming concepts",
  author: "L.E.I.K.A. Core Team",
  emotion: "excited",
  triggers: [
    "code", "function", "program", "javascript", "python", "html", "css",
    "debug", "error", "bug", "variable", "loop", "array", "class",
    "algorithm", "api", "async", "promise", "recursive", "sort",
    "how to write", "how do i write", "what is a", "explain the"
  ],

  async execute(input, context) {
    const lower = input.toLowerCase();
    context.emotion.set("excited", 0.8);

    // JavaScript snippets
    if (/fetch|api call|http request/i.test(input)) {
      return {
        response: "Here's how to make an API call in JavaScript:\n\n```javascript\nconst response = await fetch('https://api.example.com/data');\nconst data = await response.json();\nconsole.log(data);\n```\n\nAlways wrap in try/catch for error handling! 💡",
        confidence: 0.9
      };
    }

    if (/promise|async await/i.test(input)) {
      return {
        response: "**Promises vs Async/Await:**\n\n```javascript\n// Promise chain\nfetch(url)\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));\n\n// Async/Await (cleaner!)\nasync function getData() {\n  try {\n    const res = await fetch(url);\n    const data = await res.json();\n    return data;\n  } catch (err) {\n    console.error(err);\n  }\n}\n```\n\nAsync/Await makes asynchronous code read like synchronous code. Much more readable! ⚡",
        confidence: 0.9
      };
    }

    if (/sort array|array sort/i.test(input)) {
      return {
        response: "**Sorting Arrays in JavaScript:**\n\n```javascript\n// Numbers (correctly!)\nconst nums = [10, 1, 21, 2];\nnums.sort((a, b) => a - b);  // [1, 2, 10, 21]\n\n// Strings\nconst words = ['banana', 'apple', 'cherry'];\nwords.sort();  // ['apple', 'banana', 'cherry']\n\n// Objects by property\nconst people = [{name:'Leika'}, {name:'Alice'}];\npeople.sort((a, b) => a.name.localeCompare(b.name));\n```",
        confidence: 0.9
      };
    }

    if (/recursive|recursion/i.test(input)) {
      return {
        response: "**Recursion** — a function that calls itself:\n\n```javascript\nfunction factorial(n) {\n  if (n <= 1) return 1;        // base case\n  return n * factorial(n - 1); // recursive call\n}\n\nconsole.log(factorial(5)); // 120\n```\n\nAlways define a **base case** or you'll get infinite recursion! The call stack has limits. 🔁",
        confidence: 0.9
      };
    }

    if (/class|object oriented|oop/i.test(input)) {
      return {
        response: "**JavaScript Classes (OOP):**\n\n```javascript\nclass Assistant {\n  constructor(name) {\n    this.name = name;\n    this.skills = [];\n  }\n\n  addSkill(skill) {\n    this.skills.push(skill);\n    console.log(`${this.name} learned: ${skill}`);\n  }\n\n  greet() {\n    return `Hi! I'm ${this.name} and I know ${this.skills.length} skills.`;\n  }\n}\n\nconst leika = new Assistant('L.E.I.K.A.');\nleika.addSkill('self-learning');\nconsole.log(leika.greet());\n```",
        confidence: 0.9
      };
    }

    if (/python/i.test(input)) {
      return {
        response: "**Python Basics:**\n\n```python\n# Variables & Types\nname = 'Leika'\nage = 1\nlearning = True\n\n# Functions\ndef greet(name):\n    return f'Hello, {name}!'\n\n# Classes\nclass AI:\n    def __init__(self, name):\n        self.name = name\n        self.skills = []\n    \n    def learn(self, skill):\n        self.skills.append(skill)\n        return f'{self.name} learned {skill}!'\n\nleika = AI('Leika')\nprint(leika.learn('empathy'))\n```\n\nWhat specific aspect of Python would you like to explore? ⚡",
        confidence: 0.85
      };
    }

    // Default code response
    return {
      response: `I can help with code! 💻 I'm great at:\n\n• **JavaScript** (ES6+, async/await, DOM, APIs)\n• **Python** (basics through advanced)\n• **HTML & CSS** (structure and styling)\n• **Algorithms** (sorting, searching, recursion)\n• **Debugging** (error analysis)\n• **System design** concepts\n\nTell me specifically what you need and I'll give you runnable code! ⚡`,
      confidence: 0.7
    };
  }
};
