import { test } from "node:test";
import assert from "node:assert/strict";
import { endpoint } from "../dist/endpoint.js";
test("pause endpoint includes padding on both windows, never discards samples", () => {
  const a = Buffer.concat([
    Buffer.alloc(6 * 8000, 0x80),
    Buffer.alloc(8000, 255),
  ]);
  const cut = endpoint(a, a.length);
  assert.equal(cut.size, 6.6 * 8000);
  assert.equal(cut.size - cut.advance, 4000);
  assert.ok(cut.advance < cut.size);
});
test("continuous and all-silent capture stay bounded by maximum window", () => {
  for (const value of [0x80, 255]) {
    const a = Buffer.alloc(16 * 8000, value);
    assert.equal(endpoint(a, a.length - 1), undefined);
    assert.deepEqual(endpoint(a, a.length), {
      size: 16 * 8000,
      advance: 12 * 8000,
    });
  }
});
