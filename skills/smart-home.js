// skills/smart-home.js — Home Assistant control + mock fallback
export default {
  id: "smart-home",
  name: "Smart Home Control",
  version: "1.0.0",
  description: "Controls smart home devices via Home Assistant API or mock mode.",

  triggers: [
    /\b(turn on|turn off|switch on|switch off|toggle|set|dim|brighten)\b.*\b(light|lamp|fan|ac|heater|thermostat|plug|switch|tv)\b/i,
    /\b(light|lamp|fan|ac|heater|thermostat|plug|switch)\b.*\b(on|off|to \d+)\b/i,
    /\b(smart home|home automation|hue|nest|smartthings)\b/i,
    /\b(it'?s? too (dark|bright|hot|cold|warm))\b/i
  ],

  emotion: "focused",

  // Shared device state store (ephemeral, per session)
  _deviceState: {},

  async execute(input, context) {
    const lower = input.toLowerCase();

    // --- Parse action and device ---
    const actionMatch = lower.match(/\b(turn on|turn off|switch on|switch off|toggle|set|dim|brighten|enable|disable)\b/);
    const action = actionMatch
      ? (actionMatch[1].includes("off") || actionMatch[1] === "disable" ? "off" : "on")
      : (lower.includes(" off") ? "off" : "on");

    const deviceMap = {
      light: ["light", "lamp", "hue", "bulb"],
      fan: ["fan", "exhaust"],
      ac: ["ac", "air conditioner", "a/c", "aircon", "air conditioning"],
      heater: ["heater", "heat", "heating"],
      thermostat: ["thermostat", "temperature", "temp"],
      tv: ["tv", "television"],
      plug: ["plug", "outlet", "socket"]
    };

    let device = "device";
    for (const [canonical, aliases] of Object.entries(deviceMap)) {
      if (aliases.some(a => lower.includes(a))) { device = canonical; break; }
    }

    // Value extraction (e.g. "set thermostat to 22")
    const valueMatch = lower.match(/\b(?:to|at)\s+(\d{1,3})\s*(?:degrees?|%|percent)?\b/);
    const value = valueMatch ? parseInt(valueMatch[1]) : null;

    // Room / location extraction
    const roomMatch = lower.match(
      /\b(?:in|the)\s+(bedroom|living room|kitchen|bathroom|office|garage|porch|hall|hallway)\b/i
    );
    const room = roomMatch ? roomMatch[1].toLowerCase() : null;

    const deviceLabel = room ? `${room} ${device}` : device;

    // --- Home Assistant integration ---
    const HASS_URL = typeof process !== "undefined" ? process.env?.HASS_URL : null;
    const HASS_TOKEN = typeof process !== "undefined" ? process.env?.HASS_TOKEN : null;

    if (HASS_URL && HASS_TOKEN) {
      try {
        // Map to HA domain / service
        const domainMap = { light: "light", fan: "fan", ac: "climate", heater: "climate", plug: "switch", tv: "media_player" };
        const domain = domainMap[device] || "switch";
        const service = action === "on" ? "turn_on" : "turn_off";
        const entity_id = `${domain}.${deviceLabel.replace(/\s+/g, "_")}`;

        const body = { entity_id };
        if (value !== null && domain === "climate") body.temperature = value;
        if (value !== null && domain === "light") body.brightness_pct = Math.min(value, 100);

        const res = await fetch(`${HASS_URL}/api/services/${domain}/${service}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HASS_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000)
        });

        if (res.ok) {
          this._deviceState[deviceLabel] = { action, value, timestamp: Date.now() };
          context.learn({
            concept: `smart_home_${device}`,
            content: `${deviceLabel} turned ${action}${value != null ? ` (${value})` : ""} at ${new Date().toLocaleTimeString()}`,
            confidence: 1.0,
            source: "home_assistant"
          });

          return {
            response: `🏠 Done! **${deviceLabel.charAt(0).toUpperCase() + deviceLabel.slice(1)}** turned **${action}**${value != null ? ` (set to ${value})` : ""}.`,
            confidence: 1.0,
            emotion: "focused"
          };
        }
      } catch (hassErr) {
        console.warn("[smart-home] Home Assistant request failed:", hassErr.message);
        // Fall through to mock
      }
    }

    // --- Mock / offline mode ---
    this._deviceState[deviceLabel] = { action, value, timestamp: Date.now() };
    context.learn({
      concept: `smart_home_${device}`,
      content: `${deviceLabel} turned ${action}${value != null ? ` (${value})` : ""} — mock mode`,
      confidence: 0.6,
      source: "mock"
    });

    const emoji = { light: "💡", fan: "🌀", ac: "❄️", heater: "🔥", thermostat: "🌡️", tv: "📺", device: "🏠" };
    const icon = emoji[device] || emoji.device;
    const valueNote = value != null ? ` — set to **${value}${device === "thermostat" ? "°" : "%"}**` : "";
    const modeNote = !HASS_URL ? "\n\n*Note: Home Assistant not configured. Set `HASS_URL` and `HASS_TOKEN` in `.env` for real control.*" : "";

    return {
      response: `${icon} **${deviceLabel.charAt(0).toUpperCase() + deviceLabel.slice(1)} turned ${action}**${valueNote}.${modeNote}`,
      confidence: 0.7,
      emotion: "focused"
    };
  }
};
