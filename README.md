<div align="center">

# Bagah Bot

WhatsApp Bot — ESM · OOP · Baileys rc14 · SQLite

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc14-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

</div>

---

## Tentang

Bagah Bot adalah WhatsApp bot yang ditulis dengan arsitektur **ESM + OOP** menggunakan **Baileys 7.0.0-rc14** (dengan LID support) dan **SQLite** (via sql.js) untuk session & database. Semua config di-load dari `.env` sehingga aman `git pull` tanpa conflict.

## Fitur

- **Baileys 7.0.0-rc14** — LID support, native ESM, pairing code (custom 8-digit), QR terminal fallback
- **SQLite session** — `session.db` via sql.js dengan auth state native Baileys (tanpa C++ build tools)
- **SQLite database** — `database.db` menggantikan banyak file `.json`
- **Modular commands** — setiap kategori command 1 file class terpisah
- **Config via `.env`** — tidak ada value sensitif di source code
- AI, downloader, search, sticker, group management, owner tools
- **Unit test** — `node:test` bawaan Node.js, tanpa framework tambahan
- **BagahProject API** — semua fitur downloader pakai API dari [bagahproject.com](https://bagahproject.com)

## Struktur Project

```
bagah-bot/
├── index.js                   # Entry point
├── .env                       # Config deployment (gitignored)
├── .env.example               # Template config (di-commit)
├── package.json
├── .github/workflows/
│   ├── ci.yml                 # Test + audit otomatis
│   └── release.yml            # Release manual (bump version + tag)
│
└── src/
    ├── BagahBot.js            # Kelas utama (koneksi, events, send)
    ├── config/
    │   ├── index.js           # Config object dari .env
    │   └── env.js             # Parser .env yang bisa dites
    ├── database/
    │   ├── Database.js        # SQLite wrapper (users, groups, owners)
    │   └── AuthState.js       # Auth state SQLite native Baileys
    ├── handlers/
    │   ├── CommandHandler.js   # Register & route semua command
    │   └── GroupHandler.js     # Handle join/leave group
    ├── commands/               # ← TAMBAH COMMAND DI SINI
    │   ├── GeneralCommand.js   # menu, runtime
    │   ├── MakerCommand.js     # sticker, toimg, tts
    │   ├── GroupCommand.js     # promote, demote, kick, hidetag, tagall, antilink
    │   ├── OwnerCommand.js     # setppbot, addprem, delprem, listprem
    │   ├── DownloaderCommand.js# tiktok, fb, ig, igstory
    │   ├── SearchCommand.js    # tiktokstalk
    │   └── AiCommand.js        # ai
    ├── lib/
    │   ├── BagahAPI.js        # Client API bagahproject.com
    │   ├── Exif.js            # WebP sticker + EXIF metadata
    │   ├── FFmpeg.js          # Wrapper execFile ffmpeg
    │   └── uploader.js        # File upload (telegraph, etc)
    └── utils/
        ├── helpers.js         # Helpers class (HTTP, waktu, random, JSON)
        ├── logger.js          # Console logging dengan chalk
        └── serializer.js      # Message class (wrap raw baileys msg)

test/                          # Unit test (node:test)
├── authState.test.js
├── bagahbot.test.js
├── commandHandler.test.js
├── database.test.js
├── downloader.test.js
├── env.test.js
├── exif.test.js
├── groupCommand.test.js
├── helpers.test.js
└── serializer.test.js
```

## Instalasi

### 1. Clone & install

```bash
git clone https://github.com/ahmuq/bagahbot-case.git bagah-bot
cd bagah-bot
npm ci
```

### 2. Setup config

```bash
cp .env.example .env
```

Edit `.env` sesuai kebutuhan:

```env
BOT_NAME=Bagah Bot
BOT_OWNER=628xxxxxxxxxx
PAIRING_ENABLED=true
PAIRING_NUMBER=628xxxxxxxxxx
PAIRING_CUSTOM_CODE=BAGAHBOT
API_KEY=your_api_key_here
# Opsional: blokir nomor dengan awalan tertentu, contoh 212,234
BOT_BLOCKED_PREFIXES=
```

### 3. Dapatkan API Key

1. Buka [bagahproject.com](https://bagahproject.com)
2. Daftar / login akun
3. Copy API key dari dashboard
4. Paste ke `API_KEY` di file `.env`

### 4. Jalankan

```bash
npm start
```

Scan pairing code yang muncul di terminal, lalu tunggu sampai `Bot siap menerima pesan!`.

Kalau pairing dimatikan, bot akan menampilkan QR di terminal untuk di-scan.

### 5. Update tanpa conflict

```bash
git pull origin master
npm ci
# .env kamu tetap aman, tidak ke-overwrite
```

`package-lock.json` di-commit supaya versi dependency selalu konsisten. Pakai `npm ci` (bukan `npm install`) saat deploy.

## Testing

```bash
npm test              # jalankan semua unit test
npm run test:coverage # test + coverage report
```

Test memakai `node:test` bawaan Node.js, jadi tidak ada dependency framework tambahan.

## CI/CD

### CI

`.github/workflows/ci.yml` berjalan otomatis saat push ke branch mana pun,
pull request, atau manual dari tab Actions:

- `npm ci`
- `npm test` di Node.js 22 dan 24
- `npm audit --audit-level=high`

### Release

Release dijalankan manual dari **Actions → Release → Run workflow**.

Input yang tersedia:

| Input | Keterangan |
| --- | --- |
| `bump` | `patch`, `minor`, `major`, atau `prerelease` |
| `preid` | Identifier prerelease, default `rc` (hanya untuk `prerelease`) |
| `dry_run` | Preview perubahan tanpa commit, tag, push, atau release |

Workflow hanya bisa dijalankan dari branch `main`, lalu:

1. Menjalankan `npm ci`, `npm test`, dan `npm audit`.
2. Menaikkan version di `package.json` dan `package-lock.json`.
3. Commit `chore(release): vX.Y.Z` dan membuat tag `vX.Y.Z`.
4. Push commit + tag.
5. Membuat GitHub Release dengan release notes yang di-generate otomatis
   dari commit/PR sejak tag sebelumnya.

Release notes dibuat otomatis oleh GitHub dari commit/PR sejak tag sebelumnya;
tidak ada file changelog manual yang perlu di-update. Jika branch protection
memblokir push dari GitHub Actions, buat secret `RELEASE_TOKEN` berisi PAT
dengan akses `contents: write`.

---

## Cara Menambah Command Baru

Ada **2 cara**: tambah ke module yang sudah ada, atau buat module baru.

### Cara 1 — Tambah ke module yang sudah ada

Misalnya mau tambah command `!ping` di `GeneralCommand.js`:

**1.** Buka `src/commands/GeneralCommand.js`

**2.** Daftarkan di `get commands()`:

```js
get commands() {
  return new Map([
    // ... command yang sudah ada
    ["ping", { handler: this.ping.bind(this), category: "general" }],
  ]);
}
```

**3.** Buat method handler-nya:

```js
async ping(msg) {
  const start = Date.now();
  await msg.reply("Pong!");
  const latency = Date.now() - start;
  await msg.reply(`Latency: ${latency}ms`);
}
```

Selesai. Bot langsung mengenali `!ping`. Menu otomatis ikut ter-update karena
daftar command diambil dari registry berdasarkan `category`.

### Cara 2 — Buat module command baru

Misalnya mau buat kategori `fun`:

**1.** Buat file `src/commands/FunCommand.js`:

```js
/**
 * FunCommand - Command hiburan
 */
export default class FunCommand {
  constructor(bot) {
    this.bot = bot;
  }

  get commands() {
    return new Map([
      ["flip", { handler: this.coinFlip.bind(this), category: "fun" }],
      ["dice", { handler: this.rollDice.bind(this), category: "fun" }],
    ]);
  }

  async coinFlip(msg) {
    const result = Math.random() < 0.5 ? "🪙 Heads!" : "🪙 Tails!";
    await msg.reply(result);
  }

  async rollDice(msg) {
    const result = Math.floor(Math.random() * 6) + 1;
    await msg.reply(`🎲 Kamu dapet: ${result}`);
  }
}
```

**2.** Register di `src/handlers/CommandHandler.js`:

```js
// Tambah import di atas
import FunCommand from "../commands/FunCommand.js";

// Tambah di array modules dalam #registerAll()
const modules = [
  new GeneralCommand(this.bot),
  new MakerCommand(this.bot),
  // ... module lain
  new FunCommand(this.bot), // ← tambahkan di sini
];
```

Selesai. Semua command dari `FunCommand` langsung aktif dan otomatis muncul di menu.

### Pola handler

Setiap handler menerima 2 parameter:

```js
async namaCommand(msg, { args, text, command }) {
  // msg        → object Message (lihat src/utils/serializer.js)
  // args       → array kata setelah command, e.g. ["hello", "world"]
  // text       → string gabungan args, e.g. "hello world"
  // command    → string nama command yang dipanggil

  // ─── Akses bot ───
  this.bot.sock          // baileys socket
  this.bot.db            // database (SQLite)
  this.bot.config        // config dari .env
  this.bot.isCreator(jid)// cek owner

  // ─── Reply ───
  await msg.reply("teks");
  await msg.sendImage(buffer, "caption");
  await msg.sendVideo(buffer, "caption");
  await msg.sendAudio(buffer, true);  // true = voice note
  await msg.sendSticker(buffer);

  // ─── Media dari quoted ───
  if (msg.quoted) {
    const media = await msg.quoted.download();
    // media = Buffer
  }

  // ─── Throw untuk error message ───
  if (!text) throw "Masukkan teks!";
  if (!msg.isGroup) throw this.bot.config.messages.group;
}
```

---

## Tech Stack

| Komponen | Library                                 |
| -------- | --------------------------------------- |
| WhatsApp | `@whiskeysockets/baileys` 7.0.0-rc14     |
| Database | `sql.js` (pure JS SQLite)               |
| Sticker  | `jimp`, `node-webpmux`, FFmpeg (system)     |
| HTTP     | `axios`                                 |

## Requirements

- Node.js 22+
- FFmpeg dengan encoder `libwebp` (untuk sticker gambar/video)
  - Cek dengan `ffmpeg -encoders | grep libwebp`
  - Build Homebrew tertentu belum menyertakan libwebp; gunakan build FFmpeg yang mendukungnya

## Keamanan & Perawatan

- Jalankan `npm audit` secara berkala. Saat upgrade ini hasilnya `0 vulnerabilities`.
- `package-lock.json` disimpan di repo, jadi deploy memakai `npm ci` agar reproducible.
- Override `zod` ke `^4.6.7` diperlukan karena `jimp@1.6.1` masih memakai `zod@3`
  yang terkena advisory GHSA-mrhx-c7xc-m3w5. Override bisa dihapus setelah Jimp
  merilis versi yang memakai `zod@4`.
- Jangan commit `.env`, `session.db`, atau `database.db`.

## License

ISC © ahmuq
