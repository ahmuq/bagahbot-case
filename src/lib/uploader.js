import fs from "node:fs";
import axios from "axios";
import FormData from "form-data";

export default class Uploader {
  static async telegraph(filePath) {
    if (!fs.existsSync(filePath)) throw new Error("File not found");

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const { data } = await axios.post("https://telegra.ph/upload", form, {
      headers: form.getHeaders(),
      timeout: 30_000,
    });

    return `https://telegra.ph${data[0].src}`;
  }
}
