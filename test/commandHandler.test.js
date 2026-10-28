import assert from "node:assert/strict";
import test from "node:test";

import CommandHandler from "../src/handlers/CommandHandler.js";
import Logger from "../src/utils/logger.js";

Logger.info = () => {};
Logger.warn = () => {};
Logger.cmd = () => {};

const makeBot = (overrides = {}) => ({
  config: {
    version: "1.2.1",
    bot: { name: "Bagah Bot", prefix: ["", "!"] },
    messages: {
      admin: "admin only",
      botAdmin: "bot admin only",
      owner: "owner only",
      group: "group only",
      wait: "wait",
    },
  },
  isCreator: () => false,
  commandHandler: null,
  ...overrides,
});

const makeMessage = (body, overrides = {}) => {
  const replies = [];
  const message = {
    body,
    text: body,
    sender: "628111@s.whatsapp.net",
    pushName: "Tester",
    isGroup: false,
    quoted: null,
    chat: "628111@s.whatsapp.net",
    raw: {},
    senderAlt: null,
    senderJids: ["628111@s.whatsapp.net"],
    isOwner: () => false,
    reply: async (text) => {
      replies.push(text);
    },
    ...overrides,
  };

  return { message, replies };
};

test("CommandHandler registers commands and aliases", () => {
  const handler = new CommandHandler(makeBot());

  assert.ok(handler.commands.has("menu"));
  assert.ok(handler.commands.has("sticker"));
  assert.ok(handler.commands.has("antilink"));
  assert.equal(handler.commands.get("k").handler.name, "bound kick");
});

test("CommandHandler groups commands by category without aliases", () => {
  const handler = new CommandHandler(makeBot());
  const categories = new Map(handler.getCategories());

  assert.ok(categories.get("general").includes("menu"));
  assert.equal(categories.get("general").includes("allmenu"), false);

  assert.ok(categories.get("maker").includes("toimage"));
  assert.equal(categories.get("maker").includes("toimg"), false);

  assert.ok(categories.get("group").includes("kick"));
  assert.equal(categories.get("group").includes("k"), false);
  assert.ok(categories.get("group").includes("antilink"));
});

test("CommandHandler routes commands with a prefix", async () => {
  const handler = new CommandHandler(makeBot());
  const { message, replies } = makeMessage("!runtime");

  await handler.handle(message);

  assert.match(replies[0], /^BOT AKTIF SELAMA : /);
});

test("CommandHandler ignores unknown commands", async () => {
  const handler = new CommandHandler(makeBot());
  const { message, replies } = makeMessage("!doesnotexist");

  await handler.handle(message);

  assert.equal(replies.length, 0);
});

test("CommandHandler replies with command errors", async () => {
  const handler = new CommandHandler(makeBot());
  const { message, replies } = makeMessage("!sticker");

  await handler.handle(message);

  assert.equal(replies[0], "Balas Video/Image Dengan Caption !sticker");
});

test("CommandHandler only evaluates code for creators", async () => {
  const bot = makeBot();
  const handler = new CommandHandler(bot);

  const blocked = makeMessage(">1+1");
  await handler.handle(blocked.message);
  assert.equal(blocked.replies.length, 0);

  const result = makeMessage(">1+1");
  result.message.isOwner = () => true;
  await handler.handle(result.message);

  assert.equal(result.replies[0], "2");
});

test("CommandHandler refuses eval inside groups", async () => {
  const handler = new CommandHandler(makeBot());
  const { message, replies } = makeMessage(">1+1", {
    isGroup: true,
    isOwner: () => true,
  });

  await handler.handle(message);

  assert.equal(replies.length, 0);
});

test("CommandHandler ignores unprefixed text when no default prefix", async () => {
  const bot = makeBot();
  bot.config.bot.prefix = ["!"];
  const handler = new CommandHandler(bot);
  const { message, replies } = makeMessage(".runtime");

  await handler.handle(message);

  assert.equal(replies.length, 0);
});

test("menu renders every category and the bot version", async () => {
  const bot = makeBot();
  const handler = new CommandHandler(bot);
  bot.commandHandler = handler;
  const { message, replies } = makeMessage("!menu");

  await handler.handle(message);
  const text = replies[0];

  assert.match(text, /INFO BOT/);
  assert.match(text, /MAIN MENU/);
  assert.match(text, /GROUP MENU/);
  assert.match(text, /DOWNLOADER MENU/);
  assert.match(text, /!menu/);
  assert.match(text, /1\.2\.1/);
  assert.match(text, /Bagah Bot/);
});
