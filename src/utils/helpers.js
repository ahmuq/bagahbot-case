import crypto from "node:crypto";
import axios from "axios";
import moment from "moment-timezone";

const REQUEST_TIMEOUT_MS = 30_000;

export default class Helpers {
  static async getBuffer(url, options = {}) {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: REQUEST_TIMEOUT_MS,
      ...options,
      headers: {
        DNT: 1,
        "Upgrade-Insecure-Request": 1,
        ...options.headers,
      },
    });
    return response.data;
  }

  static async fetchJson(url, options = {}) {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      ...options,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...options.headers,
      },
    });
    return response.data;
  }

  static runtime(seconds) {
    const total = Number(seconds);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);

    const parts = [];
    if (days > 0) parts.push(`${days} Hari`);
    if (hours > 0) parts.push(`${hours} Jam`);
    if (minutes > 0) parts.push(`${minutes} Menit`);
    if (secs > 0) parts.push(`${secs} Detik`);

    return parts.join(", ") || "0 Detik";
  }

  static getGreeting() {
    const hour = moment().tz("Asia/Jakarta").hour();
    if (hour < 5) return "Selamat Malam";
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    if (hour < 19) return "Selamat Petang";
    return "Selamat Malam";
  }

  static formatDate() {
    return moment.tz("Asia/Jakarta").format("DD/MM/YY");
  }

  static formatTime() {
    return moment.tz("Asia/Jakarta").format("HH:mm:ss");
  }

  static getRandom(ext = "") {
    return `${crypto.randomBytes(8).toString("hex")}${ext}`;
  }

  static jsonformat(value) {
    return JSON.stringify(value, null, 2);
  }
}
