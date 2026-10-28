import util from "node:util";

import AiCommand from "../commands/AiCommand.js";
import DownloaderCommand from "../commands/DownloaderCommand.js";
import GeneralCommand from "../commands/GeneralCommand.js";
import GroupCommand from "../commands/GroupCommand.js";
import MakerCommand from "../commands/MakerCommand.js";
import OwnerCommand from "../commands/OwnerCommand.js";
import SearchCommand from "../commands/SearchCommand.js";
import Logger from "../utils/logger.js";

const PUNCTUATION_PREFIX = /^[°#*+,.?='():√%!¢£¥€π¤ΠΦ_&`™©®Δ^βα¦|\\/©^-]/;
const CATEGORY_ORDER = [
  "general",
  "ai",
  "maker",
  "group",
  "owner",
  "downloader",
  "search",
];

export default class CommandHandler {
  constructor(bot) {
    this.bot = bot;
    this.commands = new Map();
    this.#registerAll();
  }

  #registerAll() {
    const modules = [
      new GeneralCommand(this.bot),
      new MakerCommand(this.bot),
      new GroupCommand(this.bot),
      new OwnerCommand(this.bot),
      new DownloaderCommand(this.bot),
      new SearchCommand(this.bot),
      new AiCommand(this.bot),
    ];

    for (const module of modules) {
      const moduleName = module.constructor.name;

      for (const [name, command] of module.commands) {
        if (this.commands.has(name)) {
          Logger.warn(`Command "${name}" sudah terdaftar, dilewati`);
          continue;
        }

        this.commands.set(name, { ...command, module: moduleName });
      }
    }

    Logger.info(
      `Loaded ${this.commands.size} commands dari ${modules.length} module`,
    );
  }

  #getPrefix(body) {
    if (!body) return null;

    for (const prefix of this.bot.config.bot.prefix) {
      if (prefix === "") {
        return body.match(PUNCTUATION_PREFIX)?.[0] ?? null;
      }
      if (body.startsWith(prefix)) return prefix;
    }

    return null;
  }

  getCategories() {
    const grouped = new Map();

    for (const [name, command] of this.commands) {
      if (!grouped.has(command.category)) {
        grouped.set(command.category, []);
      }

      const commands = grouped.get(command.category);
      const duplicate = commands.some((existingName) => {
        const existing = this.commands.get(existingName);
        return (
          existing.module === command.module &&
          existing.handler.name === command.handler.name
        );
      });

      if (!duplicate) commands.push(name);
    }

    return [...grouped.entries()].sort(([left], [right]) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left);
      const rightIndex = CATEGORY_ORDER.indexOf(right);
      return leftIndex - rightIndex;
    });
  }

  async handle(msg) {
    const body = msg.body || msg.text || "";
    if (!body) return;

    const prefix = this.#getPrefix(body);
    if (prefix === null) {
      await this.#handleEval(msg, body);
      return;
    }

    const trimmed = body.slice(prefix.length).trim();
    if (!trimmed) return;

    const [commandName, ...args] = trimmed.split(/\s+/);
    const command = this.commands.get(commandName.toLowerCase());
    if (!command) return;

    Logger.cmd({
      command: commandName,
      pushname: msg.pushName,
      isGroup: msg.isGroup,
    });

    try {
      await command.handler(msg, {
        args,
        text: args.join(" "),
        prefix,
        command: commandName,
      });
    } catch (error) {
      const message =
        typeof error === "string"
          ? error
          : error?.message || "Unknown error";
      await msg.reply(message);
    }
  }

  async #handleEval(msg, body) {
    if (!body.startsWith(">")) return;
    if (msg.isGroup) return;
    if (!msg.isOwner()) return;

    try {
      const expression = body.slice(1).trim();
      if (!expression) return;

      const result = await eval(expression);
      await msg.reply(
        typeof result === "string" ? result : util.inspect(result),
      );
    } catch (error) {
      await msg.reply(String(error));
    }
  }
}
