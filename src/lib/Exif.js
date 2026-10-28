import crypto from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import webp from "node-webpmux";

import FFmpeg from "./FFmpeg.js";

const STICKER_SIZE = 320;
const VIDEO_DURATION_SECONDS = 5;

const STICKER_FILTER = [
  `scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease`,
  `pad=${STICKER_SIZE}:${STICKER_SIZE}:(ow-iw)/2:(oh-ih)/2:color=white@0.0`,
  "split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
].join(",");

export default class Exif {
  #tmpPath(ext) {
    const name = crypto.randomBytes(8).toString("hex");
    return path.join(tmpdir(), `${name}.${ext}`);
  }

  #cleanup(...paths) {
    for (const filePath of paths) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {}
    }
  }

  async #convertToWebp(media, inputExt, outputOptions) {
    const input = this.#tmpPath(inputExt);
    const output = this.#tmpPath("webp");

    fs.writeFileSync(input, media);

    try {
      await FFmpeg.run(["-i", input, ...outputOptions, "-f", "webp", output]);
      return fs.readFileSync(output);
    } finally {
      this.#cleanup(input, output);
    }
  }

  async imageToWebp(media) {
    return this.#convertToWebp(media, "jpg", [
      "-vcodec",
      "libwebp",
      "-vf",
      STICKER_FILTER,
      "-frames:v",
      "1",
    ]);
  }

  async videoToWebp(media) {
    return this.#convertToWebp(media, "mp4", [
      "-vcodec",
      "libwebp",
      "-vf",
      STICKER_FILTER,
      "-loop",
      "0",
      "-ss",
      "00:00:00",
      "-t",
      String(VIDEO_DURATION_SECONDS),
      "-preset",
      "default",
      "-an",
      "-vsync",
      "0",
    ]);
  }

  #createExifBuffer(metadata = {}) {
    const json = {
      "sticker-pack-id": "bagah-bot",
      "sticker-pack-name": metadata.packname || "",
      "sticker-pack-publisher": metadata.author || "",
      emojis: metadata.categories || [""],
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    return exif;
  }

  async #writeExif(webpBuffer, metadata) {
    const input = this.#tmpPath("webp");
    const output = this.#tmpPath("webp");

    fs.writeFileSync(input, webpBuffer);

    try {
      const image = new webp.Image();
      await image.load(input);
      image.exif = this.#createExifBuffer(metadata);
      await image.save(output);
      return fs.readFileSync(output);
    } finally {
      this.#cleanup(input, output);
    }
  }

  async writeExifImg(media, metadata) {
    const webpBuffer = await this.imageToWebp(media);
    return this.#writeExif(webpBuffer, metadata);
  }

  async writeExifVid(media, metadata) {
    const webpBuffer = await this.videoToWebp(media);
    return this.#writeExif(webpBuffer, metadata);
  }

  async writeExifWebp(media, metadata) {
    return this.#writeExif(media, metadata);
  }
}
