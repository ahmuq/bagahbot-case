import assert from "node:assert/strict";
import test from "node:test";

import Message from "../src/utils/serializer.js";

const makeBot = () => {
  const sent = [];
  return {
    sent,
    sock: {
      user: { id: "628999@s.whatsapp.net" },
      sendMessage: async (jid, content, options) => {
        sent.push({ jid, content, options });
      },
    },
  };
};

test("Message parses plain text messages", () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC123",
      remoteJid: "628111@s.whatsapp.net",
      fromMe: false,
    },
    pushName: "Alice",
    message: { conversation: "hello" },
  };

  const message = new Message(bot, raw);

  assert.equal(message.body, "hello");
  assert.equal(message.text, "hello");
  assert.equal(message.mtype, "conversation");
  assert.equal(message.sender, "628111@s.whatsapp.net");
  assert.equal(message.isGroup, false);
  assert.equal(message.pushName, "Alice");
});

test("Message parses group sender and mentions", () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC124",
      remoteJid: "12345@g.us",
      participant: "628222@s.whatsapp.net",
      participantAlt: "6282222@s.whatsapp.net",
      fromMe: false,
    },
    pushName: "Bob",
    message: {
      extendedTextMessage: {
        text: "!tagall hello",
        contextInfo: {
          mentionedJid: ["628333@s.whatsapp.net"],
        },
      },
    },
  };

  const message = new Message(bot, raw);

  assert.equal(message.isGroup, true);
  assert.equal(message.sender, "628222@s.whatsapp.net");
  assert.equal(message.senderAlt, "6282222@s.whatsapp.net");
  assert.equal(message.body, "!tagall hello");
  assert.deepEqual(message.mentionedJid, ["628333@s.whatsapp.net"]);
});

test("Message unwraps view once messages", () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC125",
      remoteJid: "628111@s.whatsapp.net",
      fromMe: false,
    },
    message: {
      viewOnceMessageV2: {
        message: {
          imageMessage: {
            mimetype: "image/jpeg",
            url: "https://example.com/image",
          },
        },
      },
    },
  };

  const message = new Message(bot, raw);

  assert.equal(message.mtype, "imageMessage");
  assert.equal(message.msg.mimetype, "image/jpeg");
  assert.equal(message.mime, "image/jpeg");
});

test("Message parses quoted media metadata", () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC126",
      remoteJid: "12345@g.us",
      participant: "628222@s.whatsapp.net",
      fromMe: false,
    },
    message: {
      extendedTextMessage: {
        text: "!toimg",
        contextInfo: {
          stanzaId: "QUOTED1",
          participant: "628333@s.whatsapp.net",
          quotedMessage: {
            stickerMessage: { mimetype: "image/webp" },
          },
        },
      },
    },
  };

  const message = new Message(bot, raw);

  assert.equal(message.quoted.mtype, "stickerMessage");
  assert.equal(message.quoted.id, "QUOTED1");
  assert.equal(message.quoted.sender, "628333@s.whatsapp.net");
  assert.equal(message.quoted.fromMe, false);
  assert.equal(message.mime, "image/webp");
  assert.equal(typeof message.quoted.download, "function");
});

test("Message.reply quotes the original message", async () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC127",
      remoteJid: "628111@s.whatsapp.net",
      fromMe: false,
    },
    message: { conversation: "hello" },
  };

  const message = new Message(bot, raw);
  await message.reply("world");

  assert.equal(bot.sent.length, 1);
  assert.equal(bot.sent[0].jid, "628111@s.whatsapp.net");
  assert.deepEqual(bot.sent[0].content, { text: "world" });
  assert.equal(bot.sent[0].options.quoted, raw);
});

test("Message.sendAudio marks voice notes", async () => {
  const bot = makeBot();
  const raw = {
    key: {
      id: "ABC128",
      remoteJid: "628111@s.whatsapp.net",
      fromMe: false,
    },
    message: { conversation: "hello" },
  };

  const message = new Message(bot, raw);
  const audio = Buffer.from("audio");
  await message.sendAudio(audio, true);

  assert.deepEqual(bot.sent[0].content, {
    audio,
    ptt: true,
    mimetype: "audio/mpeg",
  });
});
