import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import Env from "./env.js";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  Env.load(readFileSync(envPath, "utf-8"));
}

const pkg = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
);

const ownerNumbers = Env.list("BOT_OWNER");
const ownerJid = ownerNumbers.map(
  (number) => `${number.replace(/[^0-9]/g, "")}@s.whatsapp.net`,
);

const config = {
  version: pkg.version,

  bot: {
    name: Env.get("BOT_NAME", "Bagah Bot"),
    prefix: Env.list("BOT_PREFIX", ["", "!", ".", "#", "-", "•"], {
      keepEmpty: true,
    }),
    ownerJid,
    public: Env.bool("BOT_PUBLIC", true),
  },

  moderation: {
    blockedPrefixes: Env.list("BOT_BLOCKED_PREFIXES"),
  },

  pairing: {
    enabled: Env.bool("PAIRING_ENABLED", true),
    number: Env.get("PAIRING_NUMBER", ""),
    customCode: Env.get("PAIRING_CUSTOM_CODE", ""),
  },

  sticker: {
    packname: Env.get("STICKER_PACKNAME", "© Created By"),
    author: Env.get("STICKER_AUTHOR", "Bagah Bot"),
  },

  api: {
    baseUrl: Env.get("API_BASE_URL", "https://bagahproject.com"),
    key: Env.get("API_KEY", ""),
  },

  messages: {
    admin: "```Fitur Khusus Admin Group!!!```",
    botAdmin: "```Bot Harus Menjadi Admin Terlebih Dahulu!!!```",
    owner: "```Fitur Khusus Owner Bot!!!```",
    group: "```Fitur Digunakan Hanya Untuk Group!!!```",
    wait: "```Waittt...```",
  },
};

export default config;
