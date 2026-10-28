import fs from "node:fs";
import initSqlJs from "sql.js";

const USER_FIELDS = ["name", "premium", "banned", "saldo"];
const GROUP_FIELDS = ["name", "antilink", "welcome"];

export default class Database {
  constructor(dbPath = "database.db") {
    this.dbPath = dbPath;
    this.db = null;
    this.readyPromise = this.#init();
  }

  async #init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      this.db = new SQL.Database(fs.readFileSync(this.dbPath));
    } else {
      this.db = new SQL.Database();
    }

    this.#initTables();
    this.#save();
  }

  async ready() {
    await this.readyPromise;
  }

  #initTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        jid        TEXT PRIMARY KEY,
        name       TEXT,
        premium    INTEGER DEFAULT 0,
        banned     INTEGER DEFAULT 0,
        saldo      INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS groups (
        jid        TEXT PRIMARY KEY,
        name       TEXT,
        antilink   INTEGER DEFAULT 0,
        welcome    INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS owners (
        jid TEXT PRIMARY KEY
      )
    `);
  }

  #save() {
    fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()), {
      mode: 0o600,
    });
    try {
      fs.chmodSync(this.dbPath, 0o600);
    } catch {}
  }

  #getOne(sql, params = []) {
    const statement = this.db.prepare(sql);
    statement.bind(params);

    let result = null;
    if (statement.step()) result = statement.getAsObject();

    statement.free();
    return result;
  }

  #getAll(sql, params = []) {
    const statement = this.db.prepare(sql);
    statement.bind(params);

    const results = [];
    while (statement.step()) results.push(statement.getAsObject());

    statement.free();
    return results;
  }

  #run(sql, params = []) {
    this.db.run(sql, params);
    this.#save();
  }

  #pickFields(data, allowedFields) {
    return Object.entries(data).filter(([key]) => allowedFields.includes(key));
  }

  #upsert(table, jid, data, allowedFields, defaults) {
    const fields = this.#pickFields(data, allowedFields);
    const existing = this.#getOne(`SELECT 1 FROM ${table} WHERE jid = ?`, [jid]);

    if (existing) {
      if (!fields.length) return;

      const assignments = fields.map(([key]) => `${key} = ?`).join(", ");
      const values = fields.map(([, value]) => value);
      this.#run(`UPDATE ${table} SET ${assignments} WHERE jid = ?`, [
        ...values,
        jid,
      ]);
      return;
    }

    const merged = { ...defaults, ...Object.fromEntries(fields) };
    const columns = Object.keys(merged);
    const placeholders = columns.map(() => "?").join(", ");

    this.#run(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      columns.map((column) => merged[column]),
    );
  }

  getUser(jid) {
    return this.#getOne("SELECT * FROM users WHERE jid = ?", [jid]);
  }

  upsertUser(jid, data = {}) {
    this.#upsert(
      "users",
      jid,
      data,
      USER_FIELDS,
      { jid, name: null, premium: 0, banned: 0, saldo: 0 },
    );
  }

  setPremium(jid, status = true) {
    this.upsertUser(jid, { premium: status ? 1 : 0 });
  }

  getAllPremium() {
    return this.#getAll("SELECT * FROM users WHERE premium = 1");
  }

  getGroup(jid) {
    return this.#getOne("SELECT * FROM groups WHERE jid = ?", [jid]);
  }

  upsertGroup(jid, data = {}) {
    this.#upsert(
      "groups",
      jid,
      data,
      GROUP_FIELDS,
      { jid, name: null, antilink: 0, welcome: 1 },
    );
  }

  isAntilink(jid) {
    return this.getGroup(jid)?.antilink === 1;
  }

  addOwner(jid) {
    this.#run("INSERT OR IGNORE INTO owners (jid) VALUES (?)", [jid]);
  }

  removeOwner(jid) {
    this.#run("DELETE FROM owners WHERE jid = ?", [jid]);
  }
}
