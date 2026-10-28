import Helpers from "../utils/helpers.js";

const CATEGORY_TITLES = {
  general: "MAIN MENU",
  ai: "AI MENU",
  maker: "MAKER MENU",
  group: "GROUP MENU",
  owner: "OWNER MENU",
  downloader: "DOWNLOADER MENU",
  search: "SEARCH MENU",
};

export default class GeneralCommand {
  constructor(bot) {
    this.bot = bot;
  }

  get commands() {
    return new Map([
      ["runtime", { handler: this.runtime.bind(this), category: "general" }],
      ["menu", { handler: this.menu.bind(this), category: "general" }],
      ["allmenu", { handler: this.menu.bind(this), category: "general" }],
      [
        "groupmenu",
        { handler: this.groupMenu.bind(this), category: "general" },
      ],
    ]);
  }

  async runtime(msg) {
    await msg.reply(
      `BOT AKTIF SELAMA : ${Helpers.runtime(process.uptime())}`,
    );
  }

  async menu(msg) {
    const categories = this.bot.commandHandler.getCategories();
    const text = [
      `${Helpers.getGreeting()} ${msg.pushName}`,
      "",
      "╭──「 *INFO BOT* 」",
      `│ 🕓 Waktu : ${Helpers.formatTime()} WIB`,
      `│ 🗓️ Tanggal : ${Helpers.formatDate()}`,
      `│ ⏱️ Runtime : ${Helpers.runtime(process.uptime())}`,
      `│ 📦 Version : ${this.bot.config.version}`,
      "╰────────────",
      "",
      ...categories.map(([category, commands]) =>
        this.#renderSection(category, commands),
      ),
      "",
      `_© ${this.bot.config.bot.name}_`,
    ].join("\n");

    await msg.reply(text);
  }

  async groupMenu(msg) {
    const categories = this.bot.commandHandler
      .getCategories()
      .filter(
        ([category]) => category === "group" || category === "maker",
      );
    const text = [
      `Halo ${msg.pushName}`,
      "",
      ...categories.map(([category, commands]) =>
        this.#renderSection(category, commands),
      ),
      "",
      `Runtime: ${Helpers.runtime(process.uptime())}`,
      `_© ${this.bot.config.bot.name}_`,
    ].join("\n");

    await msg.reply(text);
  }

  #renderSection(category, commands) {
    const prefix = this.bot.config.bot.prefix.find(Boolean) || "!";
    const title = CATEGORY_TITLES[category] || category.toUpperCase();
    const lines = commands.map((name) => `│ ⿻ ${prefix}${name}`);

    return [`╭──「 *${title}* 」`, ...lines, "╰────────────"].join("\n");
  }
}
