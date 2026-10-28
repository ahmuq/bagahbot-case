import fs from "node:fs";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  areJidsSameUser,
  delay,
  fetchLatestBaileysVersion,
  isPnUser,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { fileTypeFromBuffer } from "file-type";
import pino from "pino";
import qrcode from "qrcode-terminal";

import config from "./config/index.js";
import SQLiteAuthState from "./database/AuthState.js";
import Database from "./database/Database.js";
import CommandHandler from "./handlers/CommandHandler.js";
import GroupHandler from "./handlers/GroupHandler.js";
import BagahAPI from "./lib/BagahAPI.js";
import Exif from "./lib/Exif.js";
import Helpers from "./utils/helpers.js";
import Logger from "./utils/logger.js";
import Message from "./utils/serializer.js";

const GROUP_CACHE_TTL_MS = 60_000;
const RECONNECT_DELAY_MS = 3_000;
const PAIRING_DELAY_MS = 3_000;
const PHONE_PATTERN = /^\d{10,15}$/;
const CUSTOM_CODE_PATTERN = /^[A-Z0-9]{8}$/;

export default class BagahBot {
  #groupCache = new Map();

  constructor({ dbPath = "database.db" } = {}) {
    this.sock = null;
    this.db = new Database(dbPath);
    this.config = config;
    this.exif = new Exif();
    this.api = new BagahAPI(config.api.baseUrl, config.api.key);
    this.isPublic = config.bot.public;

    this.commandHandler = null;
    this.groupHandler = null;
    this.saveCreds = null;
    this.initialized = false;
    this.reconnecting = false;
    this.usePairing = false;
  }

  async start() {
    await this.#initialize();

    const authState = await SQLiteAuthState.create("session.db");
    this.saveCreds = () => authState.saveCreds();

    const logger = pino({ level: "silent" });
    const { version } = await fetchLatestBaileysVersion();
    Logger.info(`Baileys version: ${version.join(".")}`);

    this.usePairing = Boolean(
      this.config.pairing.enabled && this.config.pairing.number,
    );

    this.sock = makeWASocket({
      logger,
      version,
      browser: Browsers.macOS("Chrome"),
      auth: {
        creds: authState.state.creds,
        keys: makeCacheableSignalKeyStore(authState.state.keys, logger),
      },
      cachedGroupMetadata: (jid) => this.getGroupMetadata(jid),
    });

    this.#bindEvents();
    await this.#handlePairing();

    Logger.info("Menunggu koneksi...");
  }

  async #initialize() {
    if (this.initialized) return;

    Logger.info("Memulai Bagah Bot...");

    await this.db.ready();
    Logger.info(`Database siap (${this.db.dbPath})`);

    this.commandHandler = new CommandHandler(this);
    this.groupHandler = new GroupHandler(this);
    this.initialized = true;
  }

  #bindEvents() {
    this.sock.ev.on("connection.update", (update) => {
      this.#onConnectionUpdate(update);
    });

    this.sock.ev.on("creds.update", this.saveCreds);

    this.sock.ev.on("messages.upsert", (upsert) => {
      this.#onMessagesUpsert(upsert).catch((error) =>
        Logger.error("Error handling message:", error),
      );
      this.#onAutoReadStatus(upsert).catch((error) =>
        Logger.error("Error reading status:", error),
      );
    });

    this.sock.ev.on("group-participants.update", (event) => {
      this.#groupCache.delete(event.id);
      this.groupHandler.handle(event);
    });

    this.sock.ev.on("groups.update", (updates) => {
      for (const update of updates || []) {
        if (update.id) this.#groupCache.delete(update.id);
      }
    });

    this.sock.ev.on("lid-mapping.update", (mapping) => {
      Logger.info(`LID mapping updated: ${JSON.stringify(mapping)}`);
    });
  }

  #onConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !this.usePairing) {
      Logger.info("Scan QR berikut untuk menghubungkan bot:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      this.#handleDisconnect(lastDisconnect);
      return;
    }

    if (connection === "open") {
      this.reconnecting = false;
      const name =
        this.sock.user?.name || this.sock.user?.verifiedName || "WhatsApp Bot";
      Logger.connection(`Terkoneksi sebagai ${name}`);
      Logger.success("Bot siap menerima pesan!");
    }
  }

  #handleDisconnect(lastDisconnect) {
    const statusCode = lastDisconnect?.error?.output?.statusCode;

    if (statusCode === DisconnectReason.loggedOut) {
      Logger.error("Logged out. Hapus session.db lalu jalankan ulang.");
      return;
    }

    if (this.reconnecting) return;
    this.reconnecting = true;
    Logger.warn("Koneksi terputus, mencoba reconnect...");

    delay(RECONNECT_DELAY_MS)
      .then(() => this.start())
      .catch((error) => Logger.error("Reconnect gagal:", error))
      .finally(() => {
        this.reconnecting = false;
      });
  }

  async #onMessagesUpsert(upsert) {
    if (upsert.type !== "notify") return;

    for (const raw of upsert.messages) {
      try {
        await this.#handleMessage(raw);
      } catch (error) {
        Logger.error("Error handling message:", error);
      }
    }
  }

  async #handleMessage(raw) {
    if (!raw.message) return;

    if (Object.keys(raw.message)[0] === "ephemeralMessage") {
      raw.message = raw.message.ephemeralMessage?.message;
    }
    if (!raw.message) return;

    if (raw.key?.remoteJid === "status@broadcast") return;
    if (!this.isPublic && !raw.key.fromMe) return;
    if (this.#isBaileysGeneratedId(raw.key.id)) return;

    const msg = new Message(this, raw);

    if (await this.#isBlockedSender(msg.sender)) {
      await this.sock.updateBlockStatus(msg.sender, "block");
      return;
    }

    await this.#checkAntilink(msg);
    await this.commandHandler.handle(msg);
  }

  #isBaileysGeneratedId(id) {
    return id?.length === 16 && id.startsWith("3EB0");
  }

  async #isBlockedSender(sender) {
    const prefixes = this.config.moderation.blockedPrefixes;
    if (!prefixes.length) return false;

    const phoneNumber = await this.#toPhoneNumber(sender);
    return Boolean(
      phoneNumber &&
        prefixes.some((prefix) => phoneNumber.startsWith(prefix)),
    );
  }

  async #onAutoReadStatus(upsert) {
    if (upsert.type !== "notify") return;

    for (const msg of upsert.messages) {
      if (msg.key.remoteJid !== "status@broadcast") continue;
      if (msg.message?.protocolMessage) continue;

      const name = msg.pushName || "Unknown";
      const number = msg.key.participant?.split("@")[0] || "";
      Logger.info(`Lihat status ${name} (${number})`);

      await this.sock.readMessages([msg.key]);
    }
  }

  async #checkAntilink(msg) {
    if (!msg.isGroup || msg.fromMe) return;
    if (!this.db.isAntilink(msg.chat)) return;

    const text = msg.body || msg.text || "";
    if (!text.includes("https://") && !text.includes("http://")) return;

    const metadata = await this.getGroupMetadata(msg.chat);
    const admins = metadata.participants
      .filter((participant) => participant.admin)
      .map((participant) => participant.id);

    if (
      msg.senderJids.some((sender) =>
        admins.some((admin) => areJidsSameUser(admin, sender)),
      )
    ) {
      return;
    }

    const botJid = this.decodeJid(this.sock.user.id);
    if (!admins.some((admin) => areJidsSameUser(admin, botJid))) return;

    await this.sock.sendMessage(
      msg.chat,
      {
        text: `*Antilink Group Terdeteksi*\n\nKamu Akan Dikeluarkan Dari Group ${metadata.subject}`,
      },
      { quoted: msg.raw },
    );

    await this.sock.groupParticipantsUpdate(msg.chat, [msg.sender], "remove");
  }

  async #handlePairing() {
    if (!this.usePairing || this.sock.authState.creds.registered) return;

    const phone = String(this.config.pairing.number);
    if (!PHONE_PATTERN.test(phone)) {
      throw new Error(
        "Invalid number, start with country code (Example: 62xxx)",
      );
    }

    await delay(PAIRING_DELAY_MS);

    try {
      const customCode = this.#normalizeCustomCode(
        this.config.pairing.customCode,
      );
      const code = await this.sock.requestPairingCode(phone, customCode);
      Logger.success(`Your Pairing Code : ${this.#formatPairingCode(code)}`);
    } catch (error) {
      Logger.error("Failed to get pairing code", error);
      this.usePairing = false;
    }
  }

  #normalizeCustomCode(rawCode) {
    if (!rawCode) return null;

    const code = String(rawCode).replace(/[-\s]/g, "").toUpperCase();
    if (CUSTOM_CODE_PATTERN.test(code)) {
      Logger.info(`Using custom pairing code: ${code}`);
      return code;
    }

    Logger.warn(
      `Invalid custom code (must be 8 alphanumeric chars, got: ${code}), using random code`,
    );
    return null;
  }

  #formatPairingCode(code) {
    return code?.match(/.{1,4}/g)?.join("-") || code;
  }

  async getGroupMetadata(jid) {
    const cached = this.#groupCache.get(jid);
    if (cached && cached.expiresAt > Date.now()) return cached.metadata;

    const metadata = await this.sock.groupMetadata(jid);
    this.#groupCache.set(jid, {
      metadata,
      expiresAt: Date.now() + GROUP_CACHE_TTL_MS,
    });

    return metadata;
  }

  decodeJid(jid) {
    return jid ? jidNormalizedUser(jid) : jid;
  }

  async #toPhoneNumber(jid) {
    if (!jid) return null;

    const normalized = jidNormalizedUser(jid);
    if (isPnUser(normalized)) return normalized.split("@")[0];

    try {
      const phoneNumber =
        await this.sock?.signalRepository?.lidMapping?.getPNForLID(normalized);
      return phoneNumber ? phoneNumber.split("@")[0] : null;
    } catch {
      return null;
    }
  }

  isCreator(sender) {
    if (!sender) return false;

    const senderJid = this.decodeJid(sender);
    const owners = new Set(
      this.config.bot.ownerJid.map((jid) => this.decodeJid(jid)),
    );

    if (this.sock?.user?.id) owners.add(this.decodeJid(this.sock.user.id));
    if (this.sock?.user?.lid) owners.add(this.decodeJid(this.sock.user.lid));

    return [...owners].some((owner) => areJidsSameUser(owner, senderJid));
  }

  async sendSticker(jid, media, quoted, options = {}) {
    const buffer = await this.#resolveMedia(media);
    const { mime } = (await fileTypeFromBuffer(buffer)) || {
      mime: "application/octet-stream",
    };

    let stickerBuffer;
    if (/image\/(jpe?g|png|gif)|octet/.test(mime)) {
      stickerBuffer =
        options.packname || options.author
          ? await this.exif.writeExifImg(buffer, options)
          : await this.exif.imageToWebp(buffer);
    } else if (/video/.test(mime)) {
      stickerBuffer =
        options.packname || options.author
          ? await this.exif.writeExifVid(buffer, options)
          : await this.exif.videoToWebp(buffer);
    } else if (/webp/.test(mime)) {
      stickerBuffer = await this.exif.writeExifWebp(buffer, options);
    } else {
      throw new Error(`Unsupported mime type: ${mime}`);
    }

    await this.sock.sendPresenceUpdate("composing", jid);
    return this.sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted });
  }

  async #resolveMedia(input) {
    if (Buffer.isBuffer(input)) return input;

    if (typeof input === "string") {
      if (/^data:.+;base64,/.test(input)) {
        return Buffer.from(input.split(",")[1], "base64");
      }
      if (/^https?:\/\//.test(input)) {
        return Helpers.getBuffer(input);
      }
      if (fs.existsSync(input)) {
        return fs.readFileSync(input);
      }
    }

    throw new Error("Unsupported media input");
  }
}
