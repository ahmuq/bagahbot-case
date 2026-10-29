import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import SQLiteAuthState from "../src/database/AuthState.js";

const withTempSession = async (callback) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bagah-auth-"));
  const sessionPath = path.join(directory, "session.db");

  try {
    await callback(sessionPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("SQLiteAuthState initializes fresh credentials", async () => {
  await withTempSession(async (sessionPath) => {
    const auth = await SQLiteAuthState.create(sessionPath);

    assert.ok(auth.state.creds);
    assert.ok(Buffer.isBuffer(auth.state.creds.noiseKey.private));
    assert.equal(typeof auth.state.keys.get, "function");
    assert.equal(typeof auth.state.keys.set, "function");
  });
});

test("SQLiteAuthState round-trips signal keys as buffers", async () => {
  await withTempSession(async (sessionPath) => {
    const auth = await SQLiteAuthState.create(sessionPath);
    const privateKey = Buffer.from([1, 2, 3, 4]);

    await auth.state.keys.set({
      "pre-key": { 1: { private: privateKey } },
    });

    const values = await auth.state.keys.get("pre-key", ["1"]);
    assert.ok(Buffer.isBuffer(values["1"].private));
    assert.deepEqual(values["1"].private, privateKey);
  });
});

test("SQLiteAuthState persists credentials and keys", async () => {
  await withTempSession(async (sessionPath) => {
    const auth = await SQLiteAuthState.create(sessionPath);
    auth.state.creds.me = {
      id: "628555@s.whatsapp.net",
      name: "Tester",
    };
    await auth.saveCreds();
    await auth.state.keys.set({
      session: { first: { value: Buffer.from("persisted") } },
    });

    const reloaded = await SQLiteAuthState.create(sessionPath);
    assert.equal(reloaded.state.creds.me.id, "628555@s.whatsapp.net");

    const values = await reloaded.state.keys.get("session", ["first"]);
    assert.equal(Buffer.from(values.first.value).toString(), "persisted");
  });
});

test("SQLiteAuthState removes keys and clears state", async () => {
  await withTempSession(async (sessionPath) => {
    const auth = await SQLiteAuthState.create(sessionPath);

    await auth.state.keys.set({
      "pre-key": { 1: { private: Buffer.from([1]) } },
    });
    await auth.state.keys.set({
      "pre-key": { 1: null },
    });

    let values = await auth.state.keys.get("pre-key", ["1"]);
    assert.equal(values["1"], null);

    await auth.state.keys.set({
      "pre-key": { 2: { private: Buffer.from([2]) } },
    });
    await auth.clearState();

    values = await auth.state.keys.get("pre-key", ["2"]);
    assert.equal(values["2"], null);
  });
});
