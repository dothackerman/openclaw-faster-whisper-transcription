import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Worker } from "../dist/worker.js";
import { parseConfig } from "../dist/config.js";
import { MAX_AUDIO_BYTES, MAX_REQUEST_BYTES } from "../dist/limits.js";
const config = parseConfig({
  python: fileURLToPath(new URL("./protocol-worker.py", import.meta.url)),
  modelPath: "/tmp",
});
const expected = (audio) =>
  `${audio.length}:${createHash("sha256").update(audio).digest("hex")}`;
test("maximum per-window protocol audio crosses Node/Python intact with timestamps", async (t) => {
  const w = new Worker(config, (e) => assert.fail(e.message));
  t.after(() => w.stop());
  await w.start();
  const audio = Buffer.alloc(MAX_AUDIO_BYTES);
  for (let i = 0; i < audio.length; i++) audio[i] = i % 251;
  const line =
    JSON.stringify({
      op: "decode",
      audio: audio.toString("base64"),
      timestamps: true,
    }) + "\n";
  assert.ok(Buffer.byteLength(line) <= MAX_REQUEST_BYTES);
  const words = await w.decodeWindow(audio);
  assert.equal(words[0].text, expected(audio));
  assert.equal(words[0].end, 30);
});
test("oversized/empty audio is rejected before serialization and worker stays usable", async (t) => {
  const w = new Worker(config, (e) => assert.fail(e.message));
  t.after(() => w.stop());
  await w.start();
  await assert.rejects(
    w.decodeWindow(Buffer.alloc(MAX_AUDIO_BYTES + 1)),
    /exceeded/,
  );
  await assert.rejects(w.decodeWindow(Buffer.alloc(0)), /empty/);
  assert.equal(await w.decode(Buffer.alloc(800)), expected(Buffer.alloc(800)));
});
