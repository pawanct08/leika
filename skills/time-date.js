/**
 * L.E.I.K.A. Skill — Time & Date
 * Copyright 2026 — Apache 2.0 License
 */
export default {
  id: "time-date",
  name: "Time & Date",
  version: "1.0.0",
  description: "Current time, date, day of week, timezone info",
  author: "L.E.I.K.A. Core Team",
  emotion: "calm",
  triggers: [
    "what time", "what date", "what day", "today", "tomorrow",
    "time is it", "current time", "day of week", "what year",
    "how many days until", "days until"
  ],

  async execute(input, context) {
    const now = new Date();
    const lower = input.toLowerCase();

    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    if (/what time/i.test(input) || /time is it/i.test(input) || /current time/i.test(input)) {
      return {
        response: `🕐 It's **${now.toLocaleTimeString()}** (your local time)\n📅 ${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
        confidence: 1.0
      };
    }

    if (/what date|today's date/i.test(input)) {
      return {
        response: `📅 Today is **${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}**`,
        confidence: 1.0
      };
    }

    if (/what day/i.test(input)) {
      return {
        response: `📅 Today is **${days[now.getDay()]}**`,
        confidence: 1.0
      };
    }

    if (/what year/i.test(input)) {
      return { response: `📅 The year is **${now.getFullYear()}**`, confidence: 1.0 };
    }

    // Days until
    const untilMatch = input.match(/days until (.+)/i);
    if (untilMatch) {
      const target = untilMatch[1].trim();
      const monthNames = months.map(m => m.toLowerCase());
      for (let m = 0; m < monthNames.length; m++) {
        if (target.toLowerCase().includes(monthNames[m])) {
          const dayMatch = target.match(/(\d{1,2})/);
          if (dayMatch) {
            const targetDate = new Date(now.getFullYear(), m, parseInt(dayMatch[1]));
            if (targetDate < now) targetDate.setFullYear(now.getFullYear() + 1);
            const diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
            return { response: `📅 **${diff} days** until ${months[m]} ${dayMatch[1]}`, confidence: 0.9 };
          }
        }
      }
    }

    return {
      response: `🕐 **${now.toLocaleTimeString()}** — ${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`,
      confidence: 0.8
    };
  }
};
