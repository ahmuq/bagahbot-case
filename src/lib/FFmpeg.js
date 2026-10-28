import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default class FFmpeg {
  static async run(args) {
    await execFileAsync("ffmpeg", ["-y", ...args]);
  }
}
