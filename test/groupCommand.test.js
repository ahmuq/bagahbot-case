import assert from "node:assert/strict";
import test from "node:test";

import GroupCommand from "../src/commands/GroupCommand.js";

const GROUP_JID = "12345@g.us";

const makeBot = () => {
  const updates = [];
  const upserts = [];

  return {
    updates,
    upserts,
    config: {
      messages: {
        admin: "admin only",
        botAdmin: "bot admin only",
        owner: "owner only",
        group: "group only",
      },
    },
    db: {
      upsertGroup: (...args) => upserts.push(args),
    },
    sock: {
      user: { id: "628999@s.whatsapp.net" },
      groupParticipantsUpdate: async (...args) => {
        updates.push(args);
        return [{ status: "200" }];
      },
      groupSettingUpdate: async (...args) => {
        updates.push(args);
      },
      groupInviteCode: async () => "invite-code",
      sendMessage: async () => {},
    },
    isCreator: () => false,
    decodeJid: (jid) => jid,
    getGroupMetadata: async () => ({
      subject: "Test Group",
      participants: [
        { id: "628111@s.whatsapp.net", admin: "admin" },
        { id: "628999@s.whatsapp.net", admin: "admin" },
        { id: "628222@s.whatsapp.net", admin: null },
      ],
    }),
  };
};

const makeMessage = (sender = "628111@s.whatsapp.net") => {
  const replies = [];
  const message = {
    isGroup: true,
    chat: GROUP_JID,
    sender,
    mentionedJid: [],
    quoted: null,
    raw: {},
    senderAlt: null,
    senderJids: [sender],
    isOwner: () => false,
    reply: async (text) => replies.push(text),
  };
  return { message, replies };
};

test("GroupCommand antilink enables the group setting", async () => {
  const bot = makeBot();
  const handler = new GroupCommand(bot).commands.get("antilink").handler;
  const { message, replies } = makeMessage();

  await handler(message, { args: ["on"], text: "on" });

  assert.deepEqual(bot.upserts[0], [
    GROUP_JID,
    { name: "Test Group", antilink: 1 },
  ]);
  assert.equal(replies[0], "Antilink diaktifkan");
});

test("GroupCommand antilink rejects non-admins", async () => {
  const bot = makeBot();
  const handler = new GroupCommand(bot).commands.get("antilink").handler;
  const { message } = makeMessage("628222@s.whatsapp.net");

  await assert.rejects(
    () => handler(message, { args: ["on"], text: "on" }),
    (error) => error === bot.config.messages.admin,
  );
});

test("GroupCommand antilink validates the mode", async () => {
  const bot = makeBot();
  const handler = new GroupCommand(bot).commands.get("antilink").handler;
  const { message } = makeMessage();

  await assert.rejects(
    () => handler(message, { args: ["maybe"], text: "maybe" }),
    (error) =>
      typeof error === "string" && error.includes("!antilink on"),
  );
});

test("GroupCommand promotes mentioned users", async () => {
  const bot = makeBot();
  const handler = new GroupCommand(bot).commands.get("promote").handler;
  const { message, replies } = makeMessage();
  message.mentionedJid = ["628222@s.whatsapp.net"];

  await handler(message, { args: [], text: "" });

  assert.deepEqual(bot.updates[0], [
    GROUP_JID,
    ["628222@s.whatsapp.net"],
    "promote",
  ]);
  assert.match(replies[0], /"status": "200"/);
});

test("GroupCommand kicks a user by phone number", async () => {
  const bot = makeBot();
  const handler = new GroupCommand(bot).commands.get("kick").handler;
  const { message } = makeMessage();

  await handler(message, { args: ["6283334445555"], text: "6283334445555" });

  assert.deepEqual(bot.updates[0], [
    GROUP_JID,
    ["6283334445555@s.whatsapp.net"],
    "remove",
  ]);
});

test("GroupCommand hidetag mentions every participant", async () => {
  const bot = makeBot();
  const sent = [];
  bot.sock.sendMessage = async (...args) => sent.push(args);
  const handler = new GroupCommand(bot).commands.get("hidetag").handler;
  const { message } = makeMessage();

  await handler(message, { args: ["hello"], text: "hello" });

  assert.equal(sent[0][0], GROUP_JID);
  assert.equal(sent[0][1].text, "hello");
  assert.deepEqual(sent[0][1].mentions, [
    "628111@s.whatsapp.net",
    "628999@s.whatsapp.net",
    "628222@s.whatsapp.net",
  ]);
});
