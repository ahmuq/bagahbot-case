import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import BagahBot from "../src/BagahBot.js";

const withBot = async (callback) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bagah-bot-"));
  const bot = new BagahBot({ dbPath: path.join(directory, "database.db") });

  try {
    await bot.db.ready();
    await callback(bot);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("BagahBot recognizes owners, the bot itself, and its LID", async () => {
  await withBot(async (bot) => {
    bot.config = {
      bot: { ownerJid: ["628111@s.whatsapp.net"] },
    };
    bot.sock = {
      user: { id: "628999@s.whatsapp.net", lid: "888@lid" },
    };

    assert.equal(bot.isCreator("628111@s.whatsapp.net"), true);
    assert.equal(bot.isCreator("628999@s.whatsapp.net"), true);
    assert.equal(bot.isCreator("888@lid"), true);
    assert.equal(bot.isCreator("628222@s.whatsapp.net"), false);
    assert.equal(bot.isCreator(null), false);
  });
});

test("BagahBot normalizes JIDs", async () => {
  await withBot(async (bot) => {
    assert.equal(
      bot.decodeJid("628111:12@s.whatsapp.net"),
      "628111@s.whatsapp.net",
    );
    assert.equal(bot.decodeJid(null), null);
  });
});

test("BagahBot caches group metadata", async () => {
  await withBot(async (bot) => {
    let calls = 0;
    bot.sock = {
      groupMetadata: async () => {
        calls += 1;
        return { subject: "Cached Group" };
      },
    };

    const first = await bot.getGroupMetadata("12345@g.us");
    const second = await bot.getGroupMetadata("12345@g.us");

    assert.equal(calls, 1);
    assert.equal(first.subject, "Cached Group");
    assert.equal(second.subject, "Cached Group");
  });
});
