import assert from "node:assert/strict";
import test from "node:test";

import Helpers from "../src/utils/helpers.js";

test("Helpers.runtime formats durations", () => {
  assert.equal(Helpers.runtime(0), "0 Detik");
  assert.equal(Helpers.runtime(59), "59 Detik");
  assert.equal(Helpers.runtime(3661), "1 Jam, 1 Menit, 1 Detik");
  assert.equal(
    Helpers.runtime(90061),
    "1 Hari, 1 Jam, 1 Menit, 1 Detik",
  );
});

test("Helpers.getRandom creates unique hex names", () => {
  const first = Helpers.getRandom(".jpg");
  const second = Helpers.getRandom(".jpg");

  assert.match(first, /^[0-9a-f]{16}\.jpg$/);
  assert.notEqual(first, second);
});

test("Helpers.jsonformat pretty prints values", () => {
  assert.equal(Helpers.jsonformat({ a: 1 }), '{\n  "a": 1\n}');
});

test("Helpers date and time formatters use expected patterns", () => {
  assert.match(Helpers.formatDate(), /^\d{2}\/\d{2}\/\d{2}$/);
  assert.match(Helpers.formatTime(), /^\d{2}:\d{2}:\d{2}$/);
});

test("Helpers.getGreeting returns a known greeting", () => {
  const greetings = [
    "Selamat Malam",
    "Selamat Pagi",
    "Selamat Siang",
    "Selamat Sore",
    "Selamat Petang",
  ];
  assert.ok(greetings.includes(Helpers.getGreeting()));
});
