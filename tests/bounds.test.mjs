import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Runtime } from "../dist/provider.js";
import { Worker } from "../dist/worker.js";
import { parseConfig } from "../dist/config.js";
import {
  AUDIO_BYTES_PER_SECOND,
  MAX_AUDIO_SECONDS,
  MAX_AUDIO_BYTES,
  MAX_REQUEST_BYTES,
} from "../dist/limits.js";

const manifest = JSON.parse(
  await readFile(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
);
const config = parseConfig({
  python: fileURLToPath(new URL("./protocol-worker.py", import.meta.url)),
  modelPath: "/tmp",
  maxAudioSeconds: manifest.configSchema.properties.maxAudioSeconds.maximum,
});
const expected = (audio) =>
  `${audio.length}:${createHash("sha256").update(audio).digest("hex")}`;

test("manifest maximum agrees with admission and base64 framing capacity", () => {
  assert.equal(config.maxAudioSeconds, MAX_AUDIO_SECONDS);
  assert.equal(
    config.maxAudioSeconds * AUDIO_BYTES_PER_SECOND,
    MAX_AUDIO_BYTES,
  );
  assert.throws(
    () =>
      parseConfig({ ...config, maxAudioSeconds: MAX_AUDIO_SECONDS + 0.001 }),
    /maxAudioSeconds/,
  );
  const line =
    JSON.stringify({
      op: "decode",
      audio: Buffer.alloc(MAX_AUDIO_BYTES).toString("base64"),
    }) + "\n";
  assert.equal(Buffer.byteLength(line), 1280027);
  assert.ok(Buffer.byteLength(line) <= MAX_REQUEST_BYTES);
});

for (const excess of [0, 1]) {
  test(
    `maximum configured audio crosses provider/Node/Python intact (${excess} excess bytes)`,
    { timeout: 10000 },
    async (t) => {
      const runtime = new Runtime(config);
      t.after(() => runtime.dispose());
      const events = [];
      let resolveFinal, rejectFinal;
      const final = new Promise((resolve, reject) => {
        resolveFinal = resolve;
        rejectFinal = reject;
      });
      const session = runtime.provider().createSession({
        providerConfig: {},
        onPartial: () => assert.fail("must not emit a stock composer partial"),
        onTranscript: (text) => {
          events.push(["final", text]);
          resolveFinal(text);
        },
        onError: (e) => {
          events.push(["error", e.message]);
          rejectFinal(e);
        },
      });
      await session.connect();
      const audio = Buffer.alloc(MAX_AUDIO_BYTES);
      for (let i = 0; i < audio.length; i++) audio[i] = i % 251;
      // Small frames exercise the actual provider accumulator and automatic cap.
      for (let i = 0; i < audio.length - 800; i += 800)
        session.sendAudio(audio.subarray(i, i + 800));
      session.sendAudio(
        Buffer.concat([audio.subarray(-800), Buffer.alloc(excess)]),
      );
      session.close();
      assert.equal(await final, expected(audio));
      assert.equal(events[0][0], "final");
      assert.equal(events.length, 2);
      assert.match(events[1][1], /duration limit/);
    },
  );
}

test("Node rejects audio above protocol capacity before encoding, leaving worker usable", async (t) => {
  const worker = new Worker(config, (e) => assert.fail(e.message));
  t.after(() => worker.stop());
  await worker.start();
  await assert.rejects(
    worker.decode(Buffer.alloc(MAX_AUDIO_BYTES + 1)),
    /audio exceeded limit/,
  );
  await assert.rejects(worker.decode(Buffer.alloc(0)), /empty/);
  assert.equal(
    await worker.decode(Buffer.alloc(800)),
    expected(Buffer.alloc(800)),
  );
});
