import Helpers from "../utils/helpers.js";

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const assertUrl = (value, example) => {
  if (!value || !isHttpUrl(value)) throw `Example : ${example}`;
};

export default class DownloaderCommand {
  constructor(bot) {
    this.bot = bot;
  }

  get commands() {
    return new Map([
      ["couple", { handler: this.couple.bind(this), category: "downloader" }],
      ["ttnwm", { handler: this.tiktokNwm.bind(this), category: "downloader" }],
      [
        "tiktok",
        { handler: this.tiktokNwm.bind(this), category: "downloader" },
      ],
      [
        "facebookdl",
        { handler: this.facebook.bind(this), category: "downloader" },
      ],
      ["fbdl", { handler: this.facebook.bind(this), category: "downloader" }],
      ["igdl", { handler: this.instagram.bind(this), category: "downloader" }],
      [
        "instadl",
        { handler: this.instagram.bind(this), category: "downloader" },
      ],
      ["igstory", { handler: this.igStory.bind(this), category: "downloader" }],
      [
        "ttmp3",
        { handler: this.tiktokAudio.bind(this), category: "downloader" },
      ],
      ["tt3", { handler: this.tiktokAudio.bind(this), category: "downloader" }],
    ]);
  }

  async couple(msg) {
    const data = await Helpers.fetchJson(
      "https://raw.githubusercontent.com/iamriz7/kopel_/main/kopel.json",
    );
    if (!Array.isArray(data) || !data.length) {
      throw "Gagal mengambil data couple";
    }

    const random = data[Math.floor(Math.random() * data.length)];
    if (!random?.male || !random?.female) {
      throw "Data couple tidak valid";
    }

    await this.#sendMedia(msg, random.male, "image", "Couple Male");
    await this.#sendMedia(msg, random.female, "image", "Couple Female");
  }

  async tiktokNwm(msg, { text }) {
    assertUrl(text, "!ttnwm https://vt.tiktok.com/ZSwWCk5o/");
    await msg.reply("Waiting...");

    const url = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(text)}`;
    const json = await Helpers.fetchJson(url);
    const videoUrl = json?.video?.noWatermark;

    if (!videoUrl) throw "Gagal mengambil video TikTok";

    const caption = [
      `⭔ ID : ${json?.id}`,
      `⭔ Title : ${json?.title}`,
      `⭔ Created At : ${json?.created_at}`,
      `⭔ Comment : ${json?.stats?.commentCount}`,
      `⭔ Shared : ${json?.stats?.shareCount}`,
      `⭔ Watched : ${json?.stats?.playCount}`,
      `⭔ Duration : ${json?.video?.durationFormatted}`,
      `⭔ Quality : ${json?.video?.ratio}`,
      `⭔ Audio : ${json?.music?.title} - ${json?.music?.author}`,
    ].join("\n");

    await this.#sendMedia(msg, videoUrl, "video", caption);
  }

  async facebook(msg, { text }) {
    assertUrl(text, "!fbdl https://www.facebook.com/...");
    await msg.reply(this.bot.config.messages.wait);

    const result = await this.bot.api.facebookDownload(text);
    if (!result.url) throw "Gagal download video Facebook";

    const caption = [
      result.description ? `⭔ ${result.description}` : "",
      `⭔ Quality : ${result.quality || "Unknown"}`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.#sendMedia(msg, result.url, "video", caption);
  }

  async instagram(msg, { text }) {
    assertUrl(text, "!igdl https://www.instagram.com/p/xxx");
    await msg.reply(this.bot.config.messages.wait);

    const media = await this.bot.api.instagramDownload(text);
    await this.#sendMediaItems(
      msg,
      media,
      (item) => (item.type === "mp4" ? "video" : "image"),
      "Media",
    );
  }

  async igStory(msg, { text }) {
    if (!text) {
      throw "Masukkan username Instagram\nContoh : !igstory kennyxepher";
    }

    const username = text.replace(/^@/, "");
    await msg.reply(this.bot.config.messages.wait);

    const { user, stories } = await this.bot.api.igStory(username);
    if (!stories.length) throw `Tidak ada story dari @${username}`;

    const profile = [
      "📱 *Instagram Story*",
      "",
      `Username  : @${user.username}`,
      `Name      : ${user.fullName}`,
      `Followers : ${user.followers}`,
      `Following : ${user.following}`,
      `Posts     : ${user.posts}`,
      `Stories   : ${stories.length} media`,
    ].join("\n");

    await msg.reply(profile);
    await this.#sendMediaItems(
      msg,
      stories,
      (item) => (item.type === "video" ? "video" : "image"),
      "Story",
    );
  }

  async tiktokAudio(msg, { text }) {
    assertUrl(text, "!ttmp3 https://vt.tiktok.com/ZS82urPBa/");
    if (!text.includes("tiktok.com")) throw "Error Link";

    const url = `https://api.tiklydown.me/api/download?url=${encodeURIComponent(text)}`;
    const json = await Helpers.fetchJson(url);
    const audioUrl = json?.music?.play_url;

    if (!audioUrl) throw "Maaf Kak Fitur Sedang Error";

    await this.bot.sock.sendMessage(
      msg.chat,
      { audio: { url: audioUrl }, mimetype: "audio/mp4" },
      { quoted: msg.raw },
    );
  }

  async #sendMediaItems(msg, items, getType, label) {
    for (const [index, item] of items.entries()) {
      const caption =
        items.length > 1 ? `${label} ${index + 1}/${items.length}` : "";
      await this.#sendMedia(msg, item.url, getType(item), caption);
    }
  }

  async #sendMedia(msg, url, type, caption = "") {
    if (!url) throw "Media URL tidak ditemukan";

    await this.bot.sock.sendMessage(
      msg.chat,
      { [type]: { url }, caption },
      { quoted: msg.raw },
    );
  }
}
