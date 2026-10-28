import { areJidsSameUser, jidNormalizedUser } from "@whiskeysockets/baileys";

import Helpers from "../utils/helpers.js";

export default class GroupCommand {
  constructor(bot) {
    this.bot = bot;
  }

  get commands() {
    return new Map([
      ["promote", { handler: this.promote.bind(this), category: "group" }],
      ["demote", { handler: this.demote.bind(this), category: "group" }],
      ["leave", { handler: this.leave.bind(this), category: "group" }],
      ["kick", { handler: this.kick.bind(this), category: "group" }],
      ["k", { handler: this.kick.bind(this), category: "group" }],
      ["hidetag", { handler: this.hidetag.bind(this), category: "group" }],
      ["tag", { handler: this.hidetag.bind(this), category: "group" }],
      ["h", { handler: this.hidetag.bind(this), category: "group" }],
      ["tagall", { handler: this.tagAll.bind(this), category: "group" }],
      ["gc", { handler: this.groupSetting.bind(this), category: "group" }],
      ["group", { handler: this.groupSetting.bind(this), category: "group" }],
      ["c", { handler: this.closeGroup.bind(this), category: "group" }],
      ["linkgroup", { handler: this.linkGroup.bind(this), category: "group" }],
      ["linkgc", { handler: this.linkGroup.bind(this), category: "group" }],
      ["lgc", { handler: this.linkGroup.bind(this), category: "group" }],
      ["antilink", { handler: this.antilink.bind(this), category: "group" }],
    ]);
  }

  async #getGroupContext(msg) {
    if (!msg.isGroup) throw this.bot.config.messages.group;

    const metadata = await this.bot.getGroupMetadata(msg.chat);
    const admins = metadata.participants
      .filter((participant) => Boolean(participant.admin))
      .map((participant) => participant.id);
    const botJid = this.bot.decodeJid(this.bot.sock.user.id);
    const isBotAdmin = admins.some((admin) =>
      areJidsSameUser(admin, botJid),
    );
    const isAdmin =
      msg.senderJids.some((sender) =>
        admins.some((admin) => areJidsSameUser(admin, sender)),
      ) || msg.isOwner();

    return { metadata, isBotAdmin, isAdmin };
  }

  #getTargetUsers(msg, text) {
    if (msg.mentionedJid?.length) return msg.mentionedJid;
    if (msg.quoted?.sender) return [msg.quoted.sender];

    const number = text?.replace(/[^0-9]/g, "");
    if (!number || number.length < 8) return [];
    return [jidNormalizedUser(`${number}@s.whatsapp.net`)];
  }

  #requireAdmin(ctx) {
    if (!ctx.isAdmin) throw this.bot.config.messages.admin;
  }

  #requireBotAdmin(ctx) {
    if (!ctx.isBotAdmin) throw this.bot.config.messages.botAdmin;
  }

  async promote(msg, { text }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    this.#requireBotAdmin(ctx);

    const users = this.#getTargetUsers(msg, text);
    if (!users.length) throw "Tag atau reply user yang ingin di-promote";

    const result = await this.bot.sock.groupParticipantsUpdate(
      msg.chat,
      users,
      "promote",
    );
    await msg.reply(Helpers.jsonformat(result));
  }

  async demote(msg, { text }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    this.#requireBotAdmin(ctx);

    const users = this.#getTargetUsers(msg, text);
    if (!users.length) throw "Tag atau reply user yang ingin di-demote";

    const result = await this.bot.sock.groupParticipantsUpdate(
      msg.chat,
      users,
      "demote",
    );
    await msg.reply(Helpers.jsonformat(result));
  }

  async leave(msg) {
    if (!msg.isOwner()) {
      throw this.bot.config.messages.owner;
    }

    await this.bot.sock.groupLeave(msg.chat);
    await msg.reply("Sukses keluar dari group");
  }

  async kick(msg, { text }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    this.#requireBotAdmin(ctx);

    const users = this.#getTargetUsers(msg, text);
    if (!users.length) throw "Tag atau reply user yang ingin di-kick";

    await msg.reply("Otw kick...");
    const result = await this.bot.sock.groupParticipantsUpdate(
      msg.chat,
      users,
      "remove",
    );
    await msg.reply(Helpers.jsonformat(result));
  }

  async hidetag(msg, { text }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);

    await this.bot.sock.sendMessage(msg.chat, {
      text: text || "",
      mentions: ctx.metadata.participants.map((participant) => participant.id),
    });
  }

  async tagAll(msg, { text }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    if (!text) throw "Teks?";

    const mentions = ctx.metadata.participants.map(
      (participant) => participant.id,
    );
    const lines = mentions.map(
      (jid) => `⚘ @${jid.split("@")[0]}`,
    );
    const message = [
      "══✪〘 *😎 Tag All* 〙✪══",
      "",
      text,
      "",
      ...lines,
    ].join("\n");

    await this.bot.sock.sendMessage(msg.chat, {
      text: message,
      mentions,
    });
  }

  async groupSetting(msg, { args }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    this.#requireBotAdmin(ctx);

    const mode = args[0];
    if (mode !== "c" && mode !== "o") {
      throw "Kirim perintah !gc o/c\nContoh : !gc c (close) atau !gc o (open)";
    }

    const announcement = mode === "c";
    await this.bot.sock.groupSettingUpdate(
      msg.chat,
      announcement ? "announcement" : "not_announcement",
    );
    await msg.reply(
      announcement
        ? "Sukses mengizinkan hanya admin yang dapat mengirim pesan"
        : "Sukses mengizinkan semua peserta dapat mengirim pesan",
    );
  }

  async closeGroup(msg) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);
    this.#requireBotAdmin(ctx);

    await this.bot.sock.groupSettingUpdate(msg.chat, "announcement");
    await msg.reply("Sukses menutup grup");
  }

  async linkGroup(msg) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireBotAdmin(ctx);

    const code = await this.bot.sock.groupInviteCode(msg.chat);
    await msg.reply(
      `https://chat.whatsapp.com/${code}\n\nLink Group : ${ctx.metadata.subject}`,
    );
  }

  async antilink(msg, { args }) {
    const ctx = await this.#getGroupContext(msg);
    this.#requireAdmin(ctx);

    const mode = args[0]?.toLowerCase();
    if (mode !== "on" && mode !== "off") {
      throw "Contoh penggunaan: !antilink on / !antilink off";
    }

    const enabled = mode === "on" ? 1 : 0;
    this.bot.db.upsertGroup(msg.chat, {
      name: ctx.metadata.subject,
      antilink: enabled,
    });

    await msg.reply(`Antilink ${enabled ? "diaktifkan" : "dimatikan"}`);
  }
}
