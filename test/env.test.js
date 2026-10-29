import assert from "node:assert/strict";
import test from "node:test";

import Env from "../src/config/env.js";

test("Env.parseValue strips quotes", () => {
  assert.equal(Env.parseValue('"hello world"'), "hello world");
  assert.equal(Env.parseValue("'single value'"), "single value");
});

test("Env.parseValue strips inline comments only when unquoted", () => {
  assert.equal(Env.parseValue("value # comment"), "value");
  assert.equal(Env.parseValue("value#not-a-comment"), "value#not-a-comment");
  assert.equal(Env.parseValue('"value # keep"'), "value # keep");
  assert.equal(Env.parseValue("   "), "");
});

test("Env.load skips comments, invalid lines, and existing keys", () => {
  const target = { EXISTING: "keep" };
  const content = [
    "# comment",
    "",
    "EXISTING=ignored",
    "NEW_KEY=new value",
    "QUOTED=\"quoted value\"",
    "INVALID LINE",
    "WITH_COMMENT=value # note",
  ].join("\n");

  Env.load(content, target);

  assert.deepEqual(target, {
    EXISTING: "keep",
    NEW_KEY: "new value",
    QUOTED: "quoted value",
    WITH_COMMENT: "value",
  });
});

test("Env.load strips a UTF-8 BOM", () => {
  const target = {};
  Env.load("\uFEFFKEY=value", target);
  assert.equal(target.KEY, "value");
});

test("Env.bool accepts common truthy values", () => {
  process.env.TEST_ENV_BOOL = "YES";
  assert.equal(Env.bool("TEST_ENV_BOOL"), true);
  process.env.TEST_ENV_BOOL = "0";
  assert.equal(Env.bool("TEST_ENV_BOOL"), false);
  process.env.TEST_ENV_BOOL = "off";
  assert.equal(Env.bool("TEST_ENV_BOOL", true), false);
  delete process.env.TEST_ENV_BOOL;

  assert.equal(Env.bool("TEST_ENV_MISSING", true), true);
});

test("Env.list supports empty entries for prefixes", () => {
  process.env.TEST_ENV_LIST = ",!,.,-";
  assert.deepEqual(Env.list("TEST_ENV_LIST", [], { keepEmpty: true }), [
    "",
    "!",
    ".",
    "-",
  ]);
  assert.deepEqual(Env.list("TEST_ENV_LIST"), ["!", ".", "-"]);
  delete process.env.TEST_ENV_LIST;

  assert.deepEqual(Env.list("TEST_ENV_MISSING", ["fallback"]), ["fallback"]);
});
