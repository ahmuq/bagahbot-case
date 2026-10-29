import {
  areJidsSameUser,
  downloadContentFromMessage,
  getContentType,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

const VIEW_ONCE_TYPES = new Set([
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
]);

export default class Message {
  constructor(bot, raw) {
    this.bot = bot;
    this.raw = raw;
    this.#parse();
  }

  #parse() {
    const raw = this.raw;

    this.id = raw.key.id;
    this.chat = raw.key.remoteJid;
    this.fromMe = raw.key.fromMe;
    this.isGroup = this.chat?.endsWith("@g.us") || false;
    this.pushName = raw.pushName || "No Name";

    const participant = raw.key.participant || raw.participant;
    this.sender = this.#decodeJid(
      (this.fromMe && this.bot.sock.user?.id) || participant || this.chat || "",
    );
    this.senderAlt = this.#decodeJid(
      this.fromMe
        ? this.bot.sock.user?.lid
        : raw.key.participantAlt || raw.participantAlt,
    );

    if (!raw.message) return;

    const message =
      Object.keys(raw.message)[0] === "ephemeralMessage"
        ? raw.message.ephemeralMessage?.message
        : raw.message;
    if (!message) return;

    let mtype = getContentType(message);
    let content = message[mtype];

    if (VIEW_ONCE_TYPES.has(mtype)) {
      const inner = content?.message;
      mtype = getContentType(inner);
      content = inner?.[mtype];
    }

    this.mtype = mtype;
    this.msg = content;

    this.body =
      message.conversation ||
      this.msg?.caption ||
      this.msg?.text ||
      (this.mtype === "listResponseMessage" &&
        this.msg?.singleSelectReply?.selectedRowId) ||
      (this.mtype === "buttonsResponseMessage" && this.msg?.selectedButtonId) ||
      "";

    this.text =
      this.msg?.text ||
      this.msg?.caption ||
      message.conversation ||
      this.msg?.contentText ||
      this.msg?.selectedDisplayText ||
      this.msg?.title ||
      "";

    this.mentionedJid = this.msg?.contextInfo?.mentionedJid || [];

    this.#parseQuoted();
  }

  #parseQuoted() {
    const contextInfo = this.msg?.contextInfo;
    if (!contextInfo?.quotedMessage) {
      this.quoted = null;
      return;
    }

    let quoted = contextInfo.quotedMessage;
    let type = getContentType(quoted);
    let content = quoted[type];

    while (type === "productMessage" || VIEW_ONCE_TYPES.has(type)) {
      const next = type === "productMessage" ? content : content?.message;
      if (!next) break;
      type = getContentType(next);
      content = next[type];
    }

    if (typeof content === "string") content = { text: content };

    this.quoted = {
      ...content,
      mtype: type,
      id: contextInfo.stanzaId,
      chat: contextInfo.remoteJid || this.chat,
      sender: this.#decodeJid(contextInfo.participant),
      fromMe: areJidsSameUser(
        contextInfo.participant,
        this.bot.sock.user?.id,
      ),
      text:
        content?.text ||
        content?.caption ||
        content?.conversation ||
        content?.selectedDisplayText ||
        "",
      msg: content,
      download: () => this.#downloadMedia(content, type),
    };
  }

  #decodeJid(jid) {
    return jid ? jidNormalizedUser(jid) : jid;
  }

  async #downloadMedia(msg, type = this.mtype) {
    const mime = (msg || this.msg)?.mimetype || "";
    const mediaType = type
      ? type.replace(/Message$/i, "")
      : mime.split("/")[0];
    const stream = await downloadContentFromMessage(msg || this.msg, mediaType);

    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  }

  async reply(text) {
    return this.bot.sock.sendMessage(
      this.chat,
      { text: String(text) },
      { quoted: this.raw },
    );
  }

  async sendImage(buffer, caption = "") {
    return this.bot.sock.sendMessage(
      this.chat,
      { image: buffer, caption },
      { quoted: this.raw },
    );
  }

  async sendAudio(buffer, ptt = false) {
    return this.bot.sock.sendMessage(
      this.chat,
      { audio: buffer, ptt, mimetype: "audio/mpeg" },
      { quoted: this.raw },
    );
  }

  get mime() {
    return (this.quoted?.msg || this.quoted || this.msg)?.mimetype || "";
  }

  get senderJids() {
    return [...new Set([this.sender, this.senderAlt].filter(Boolean))];
  }

  isOwner() {
    return this.senderJids.some((jid) => this.bot.isCreator(jid));
  }
}
