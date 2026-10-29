const ENV_LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

export default class Env {
  static parseValue(raw) {
    const value = String(raw).trim();
    if (!value) return "";

    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      return value.slice(1, -1);
    }

    return value.replace(/\s+#.*$/, "").trim();
  }

  static load(content, target = process.env) {
    const normalized = String(content).replace(/^\uFEFF/, "");

    for (const line of normalized.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(ENV_LINE);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (key in target) continue;

      target[key] = Env.parseValue(rawValue);
    }

    return target;
  }

  static get(key, fallback = "") {
    return process.env[key] ?? fallback;
  }

  static bool(key, fallback = false) {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }

  static list(key, fallback = [], { keepEmpty = false } = {}) {
    const value = process.env[key];
    if (!value) return fallback;

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => keepEmpty || item);
  }
}
