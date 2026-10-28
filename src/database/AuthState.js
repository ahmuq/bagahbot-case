import { BufferJSON, initAuthCreds, proto } from "@whiskeysockets/baileys";
import fs from "node:fs";
import initSqlJs from "sql.js";

const SESSION_KEY = "bagah-bot";

class SqlJsStorageAdapter {
  #db;
  #path;
  #ready;

  constructor(dbPath) {
    this.#path = dbPath;
    this.#ready = this.#init();
  }

  async #init() {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.#path)) {
      this.#db = new SQL.Database(fs.readFileSync(this.#path));
    } else {
      this.#db = new SQL.Database();
    }

    this.#db.run(`
      CREATE TABLE IF NOT EXISTS kv (
        key   TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    this.#saveToDisk();
  }

  async ready() {
    await this.#ready;
  }

  #saveToDisk() {
    fs.writeFileSync(this.#path, Buffer.from(this.#db.export()), {
      mode: 0o600,
    });
    try {
      fs.chmodSync(this.#path, 0o600);
    } catch {}
  }

  async get(key) {
    await this.#ready;

    const statement = this.#db.prepare("SELECT value FROM kv WHERE key = ?");
    statement.bind([key]);

    let result;
    if (statement.step()) {
      result = statement.getAsObject().value;
    }
    statement.free();

    return result ?? undefined;
  }

  async setMany(entries) {
    await this.#ready;
    if (!entries.length) return;

    this.#db.run("BEGIN");
    try {
      for (const { key, value } of entries) {
        if (value === null) {
          this.#db.run("DELETE FROM kv WHERE key = ?", [key]);
        } else {
          this.#db.run("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [
            key,
            value,
          ]);
        }
      }
      this.#db.run("COMMIT");
    } catch (error) {
      this.#db.run("ROLLBACK");
      throw error;
    }

    this.#saveToDisk();
  }

  async clear() {
    await this.#ready;
    this.#db.run("DELETE FROM kv");
    this.#saveToDisk();
  }
}

export default class SQLiteAuthState {
  #storage;
  #creds;
  state;

  constructor(storage) {
    this.#storage = storage;
  }

  static async create(sessionPath = "session.db") {
    const storage = new SqlJsStorageAdapter(sessionPath);
    await storage.ready();

    const authState = new SQLiteAuthState(storage);
    await authState.#init();
    return authState;
  }

  #storageKey(key) {
    return `${SESSION_KEY}:${key}`;
  }

  async #readData(key) {
    try {
      const data = await this.#storage.get(this.#storageKey(key));
      return data ? JSON.parse(data, BufferJSON.reviver) : null;
    } catch {
      return null;
    }
  }

  #serialize(data) {
    return JSON.stringify(data, BufferJSON.replacer);
  }

  async #init() {
    this.#creds = (await this.#readData("creds")) || initAuthCreds();

    this.state = {
      creds: this.#creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await this.#readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data) => {
          const entries = [];

          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              entries.push({
                key: this.#storageKey(`${category}-${id}`),
                value: value ? this.#serialize(value) : null,
              });
            }
          }

          await this.#storage.setMany(entries);
        },
      },
    };
  }

  saveCreds() {
    return this.#storage.setMany([
      {
        key: this.#storageKey("creds"),
        value: this.#serialize(this.#creds),
      },
    ]);
  }

  clearState() {
    return this.#storage.clear();
  }
}
