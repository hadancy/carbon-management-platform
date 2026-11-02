import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { createUuid } from "../src/lib/uuid";

test("UUID generation prefers the native method when available", (t) => {
  const expected = "01234567-89ab-4cde-8fab-0123456789ab";
  const crypto = {
    randomUUID() {
      assert.equal(this, crypto);
      return expected;
    },
    getRandomValues() {
      assert.fail("native UUID generation must not use the fallback");
    },
  };
  t.mock.getter(globalThis, "crypto", () => crypto);

  assert.equal(createUuid(), expected);
});

test("UUID fallback sets the v4 version and variant without randomUUID", (t) => {
  let fill = 0;
  const crypto = {
    getRandomValues(bytes: Uint8Array) {
      assert.equal(this, crypto);
      assert.equal(bytes.length, 16);
      return bytes.fill(fill);
    },
  };
  t.mock.getter(globalThis, "crypto", () => crypto);

  assert.equal(createUuid(), "00000000-0000-4000-8000-000000000000");
  fill = 255;
  assert.equal(createUuid(), "ffffffff-ffff-4fff-bfff-ffffffffffff");
});

test("UUID fallback produces distinct IDs accepted by the API UUID schema", (t) => {
  const crypto = globalThis.crypto;
  t.mock.getter(globalThis, "crypto", () => ({
    getRandomValues: crypto.getRandomValues.bind(crypto),
  }));
  const ids = Array.from({ length: 128 }, () => createUuid());

  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.equal(z.uuid().parse(id), id);
    assert.equal(id[14], "4");
  }
});
