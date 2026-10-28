import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "../src/database/Database.js";

const withTempDatabase = async (callback) => {
  const directory = mkdtempSync(path.join(tmpdir(), "bagah-db-"));
  const dbPath = path.join(directory, "database.db");
  const db = new Database(dbPath);

  try {
    await db.ready();
    await callback(db, dbPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

test("Database stores and updates users", async () => {
  await withTempDatabase(async (db) => {
    const jid = "628111@s.whatsapp.net";

    db.upsertUser(jid, { name: "Alice", premium: 1 });

    assert.equal(db.getUser(jid).name, "Alice");
    assert.equal(db.getUser(jid).premium, 1);
    assert.equal(db.getAllPremium().length, 1);

    db.setPremium(jid, false);

    assert.equal(db.getUser(jid).premium, 0);
    assert.equal(db.getAllPremium().length, 0);
  });
});

test("Database ignores unknown user fields", async () => {
  await withTempDatabase(async (db) => {
    const jid = "628222@s.whatsapp.net";

    db.upsertUser(jid, { name: "Bob", injected: "ignored" });

    const user = db.getUser(jid);
    assert.equal(user.name, "Bob");
    assert.equal("injected" in user, false);
  });
});

test("Database stores group antilink settings", async () => {
  await withTempDatabase(async (db) => {
    const jid = "12345@g.us";

    assert.equal(db.isAntilink(jid), false);

    db.upsertGroup(jid, { name: "Group", antilink: 1 });
    assert.equal(db.isAntilink(jid), true);
    assert.equal(db.getGroup(jid).name, "Group");

    db.upsertGroup(jid, { antilink: 0 });
    assert.equal(db.isAntilink(jid), false);
  });
});

test("Database persists data between instances", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "bagah-db-"));
  const dbPath = path.join(directory, "database.db");

  try {
    const first = new Database(dbPath);
    await first.ready();
    first.upsertUser("628333@s.whatsapp.net", { name: "Carol" });

    const second = new Database(dbPath);
    await second.ready();
    assert.equal(second.getUser("628333@s.whatsapp.net").name, "Carol");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Database owner operations are idempotent", async () => {
  await withTempDatabase(async (db) => {
    const jid = "628444@s.whatsapp.net";

    db.addOwner(jid);
    db.addOwner(jid);

    let result = db.db.exec("SELECT jid FROM owners");
    assert.deepEqual(result[0].values, [[jid]]);

    db.removeOwner(jid);
    db.removeOwner(jid);

    result = db.db.exec("SELECT jid FROM owners");
    assert.deepEqual(result, []);
  });
});
