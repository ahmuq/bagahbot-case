import assert from "node:assert/strict";
import test from "node:test";

import Exif from "../src/lib/Exif.js";

const TINY_WEBP = Buffer.from(
  "UklGRhIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=",
  "base64",
);

test("Exif.writeExifWebp returns a webp buffer with metadata", async () => {
  const exif = new Exif();

  const result = await exif.writeExifWebp(TINY_WEBP, {
    packname: "Pack Name",
    author: "Author Name",
  });

  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.slice(0, 4).toString(), "RIFF");
  assert.equal(result.slice(8, 12).toString(), "WEBP");
  assert.ok(result.includes("Pack Name"));
  assert.ok(result.includes("Author Name"));
});

test("Exif.writeExifWebp handles missing metadata", async () => {
  const exif = new Exif();

  const result = await exif.writeExifWebp(TINY_WEBP);

  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.slice(0, 4).toString(), "RIFF");
});
