import Logger from "../utils/logger.js";

export default class GroupHandler {
  constructor(bot) {
    this.bot = bot;
  }

  async handle(event) {
    try {
      const member = event.participants?.[0];
      if (!member) return;

      const metadata = await this.bot.getGroupMetadata(event.id);

      if (event.action === "add") {
        await this.#handleJoin(event, metadata, member);
      } else if (event.action === "remove") {
        await this.#handleLeave(event, metadata, member);
      }
    } catch (error) {
      Logger.error("Group handler error:", error);
    }
  }

  async #handleJoin(event, metadata, member) {
    const text = [
      `Halo Kak @${member.split("@")[0]}`,
      "*Selamat Datang Di Grup*",
      `*${metadata.subject}*`,
      "Semoga Betah DiGroup",
      metadata.desc ? `*Deskripsi : ${metadata.desc}*` : "",
    ]
      .filter(Boolean)
      .join("\n");

    await this.bot.sock.sendMessage(event.id, {
      text,
      mentions: [member],
    });
  }

  async #handleLeave(event, metadata, member) {
    const text = [
      `Selamat Tinggal Kak @${member.split("@")[0]}`,
      "*Semoga Sukses Di Luar Sana*",
      `_~Admin ${metadata.subject}_`,
    ].join("\n");

    await this.bot.sock.sendMessage(event.id, {
      text,
      mentions: [member],
    });
  }
}
