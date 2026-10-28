import assert from "node:assert/strict";
import test from "node:test";

import DownloaderCommand from "../src/commands/DownloaderCommand.js";

const makeCommand = () =>
  new DownloaderCommand({
    config: { messages: { wait: "wait" } },
    api: {},
    sock: { sendMessage: async () => {} },
  });

const makeMessage = () => ({
  chat: "628111@s.whatsapp.net",
  raw: {},
  reply: async () => {},
});

test("DownloaderCommand validates download URLs", async () => {
  const handler = makeCommand().commands.get("tiktok").handler;

  await assert.rejects(
    () => handler(makeMessage(), { text: "not-a-url" }),
    (error) => String(error).includes("Example"),
  );
});

test("DownloaderCommand validates TikTok audio URLs", async () => {
  const handler = makeCommand().commands.get("ttmp3").handler;

  await assert.rejects(
    () => handler(makeMessage(), { text: "javascript:alert(1)" }),
    (error) => String(error).includes("Example"),
  );
});

test("DownloaderCommand requires an Instagram username", async () => {
  const handler = makeCommand().commands.get("igstory").handler;

  await assert.rejects(
    () => handler(makeMessage(), { text: "" }),
    (error) => String(error).includes("username Instagram"),
  );
});
