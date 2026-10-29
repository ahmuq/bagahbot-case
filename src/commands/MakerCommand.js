import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import FFmpeg from "../lib/FFmpeg.js";
import Uploader from "../lib/uploader.js";
import Helpers from "../utils/helpers.js";
const MAX_STICKER_SECONDS = 10;

export default class MakerCommand {
  constructor(bot) {
    this.bot = bot;
  }

  get commands() {
    return new Map([
      ["toimage", { handler: this.toImage.bind(this), category: "maker" }],
      ["toimg", { handler: this.toImage.bind(this), category: "maker" }],
      ["tts", { handler: this.tts.bind(this), category: "maker" }],
      ["tourl", { handler: this.toUrl.bind(this), category: "maker" }],
      ["url", { handler: this.toUrl.bind(this), category: "maker" }],
      ["sticker", { handler: this.sticker.bind(this), category: "maker" }],
      ["s", { handler: this.sticker.bind(this), category: "maker" }],
      ["stickergif", { handler: this.sticker.bind(this), category: "maker" }],
      ["sgif", { handler: this.sticker.bind(this), category: "maker" }],
    ]);
  }

  async toImage(msg) {
    const quoted = this.#requireQuoted(msg, "Reply sticker dengan caption !toimg");
    if (!/webp/.test(msg.mime)) {
      throw "Balas sticker dengan caption *!toimg*";
    }

    const media = await quoted.download();
    const input = this.#tmpPath(".webp");
    const output = this.#tmpPath(".png");

    await writeFile(input, media);
    try {
      await FFmpeg.run(["-i", input, output]);
      await msg.sendImage(await readFile(output));
    } finally {
      await this.#cleanup(input, output);
    }
  }

  async tts(msg, { text }) {
    if (!text) throw "Contoh:\n!tts hallo bro";

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
    await msg.sendAudio({ url }, true);
  }

  async toUrl(msg) {
    const quoted = this.#requireQuoted(
      msg,
      "Kirim/Reply Image dengan caption !tourl",
    );
    if (!/image/.test(msg.mime)) {
      throw "Kirim/Reply Image dengan caption !tourl";
    }

    await msg.reply(this.bot.config.messages.wait);

    const media = await quoted.download();
    const tempPath = this.#tmpPath(".jpg");
    await writeFile(tempPath, media);

    try {
      const url = await Uploader.telegraph(tempPath);
      await msg.reply(`${url}\n\n🖨️ Nih Link Nya`);
    } catch {
      await msg.reply(
        "Mohon Maaf Server Telegraph Sedang Error\nCoba Lagi Nanti",
      );
    } finally {
      await this.#cleanup(tempPath);
    }
  }

  async sticker(msg) {
    const quoted = this.#requireQuoted(
      msg,
      "Balas Video/Image Dengan Caption !sticker",
    );
    const mime = msg.mime;
    const { packname, author } = this.bot.config.sticker;

    if (!/image|video/.test(mime)) {
      throw "Kirim Gambar/Video Dengan Caption !sticker\nDurasi Video 1-10 Detik";
    }

    if (/video/.test(mime)) {
      const seconds = Number(quoted.msg?.seconds ?? quoted.seconds ?? 0);
      if (seconds > MAX_STICKER_SECONDS) {
        throw `Maksimal ${MAX_STICKER_SECONDS} detik!`;
      }
    }

    const media = await quoted.download();
    await this.bot.sendSticker(msg.chat, media, msg.raw, {
      packname,
      author,
    });
  }

  #requireQuoted(msg, errorMessage) {
    if (!msg.quoted) throw errorMessage;
    return msg.quoted;
  }

  #tmpPath(ext) {
    return path.join(tmpdir(), Helpers.getRandom(ext));
  }

  async #cleanup(...paths) {
    await Promise.all(
      paths.map((filePath) => unlink(filePath).catch(() => undefined)),
    );
  }
}
