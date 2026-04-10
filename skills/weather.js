// skills/weather.js — Real-time weather via server proxy (/api/weather)
export default {
  id: "weather",
  name: "Weather Awareness",
  version: "1.0.0",
  description: "Fetches real-time weather conditions and forecasts via OpenWeatherMap.",

  triggers: [
    /\b(weather|temperature|forecast|rain|snow|hot|cold|humid|wind|storm|sunny|cloudy)\b/i,
    /\b(what's the weather|how's the weather|will it rain|is it going to)\b/i
  ],

  emotion: "thoughtful",

  async execute(input, context) {
    // Extract city from input, or default to configured city
    const cityMatch = input.match(
      /\b(?:in|at|for|near|around)\s+([A-Za-z][A-Za-z\s]{1,30}?)(?:\s*[?!.,]|$)/i
    );
    const city = cityMatch ? cityMatch[1].trim() : null;

    const url = city
      ? `http://localhost:3000/api/weather?q=${encodeURIComponent(city)}`
      : `http://localhost:3000/api/weather`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) return null;

      const data = await res.json();
      if (data.error) return null;

      const {
        name = city || "your area",
        weather = [{ description: "unknown" }],
        main = {},
        wind = {},
        sys = {}
      } = data;

      const desc = weather[0]?.description || "unknown conditions";
      const temp = main.temp != null ? `${Math.round(main.temp)}°C` : "N/A";
      const feels = main.feels_like != null ? `${Math.round(main.feels_like)}°C` : "N/A";
      const humidity = main.humidity != null ? `${main.humidity}%` : "N/A";
      const windSpeed = wind.speed != null ? `${wind.speed} m/s` : "N/A";

      // Cache in memory
      context.learn({
        concept: `weather_${name.toLowerCase()}`,
        content: `${name}: ${desc}, ${temp}, feels ${feels}, humidity ${humidity}`,
        confidence: 1.0,
        source: "openweathermap"
      });

      return {
        response: `🌤️ **${name} — Current Weather**\n\n` +
          `**Conditions:** ${desc.charAt(0).toUpperCase() + desc.slice(1)}\n` +
          `**Temperature:** ${temp} (feels like ${feels})\n` +
          `**Humidity:** ${humidity}\n` +
          `**Wind:** ${windSpeed}\n\n` +
          `Want a detailed forecast or weather for another city?`,
        confidence: 0.95,
        emotion: "thoughtful"
      };
    } catch (err) {
      console.warn("[weather] Fetch failed:", err.message);
      return null;
    }
  }
};
