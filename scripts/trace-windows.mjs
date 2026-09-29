// Offline diagnostics only: do not use these timings as paced latency evidence.
import { parseConfig } from "../dist/config.js";
import { createHash } from "node:crypto";
import { Runtime } from "../dist/provider.js";
import { Worker } from "../dist/worker.js";
import { Stitcher } from "../dist/stitch.js";
import { readFile, writeFile } from "node:fs/promises";
const [profile, audioPath, output = ".local/window-trace.json"] =
  process.argv.slice(2);
if (!profile || !audioPath)
  throw Error("Usage: node scripts/trace-windows.mjs PROFILE AUDIO OUTPUT");
const config = parseConfig(JSON.parse(await readFile(profile, "utf8")));
const audio = await readFile(audioPath);
if (audio.length > 300 * 8000)
  throw Error("Diagnostic fixture exceeds five minutes");
const records = [];
const original = Stitcher.prototype.add;
Stitcher.prototype.add = function (words, start, end) {
  const before = this.text();
  try {
    return original.call(this, words, start, end);
  } finally {
    records.push({ start, end, words, before, after: this.text() });
  }
};
const pending = new Set();
const runtime = new Runtime(config, (cb) => {
  const w = new Worker(config, cb),
    decode = w.decodeWindow.bind(w);
  w.decodeWindow = (a) => {
    const p = decode(a);
    pending.add(p);
    p.finally(() => pending.delete(p)).catch(() => {});
    return p;
  };
  return w;
});
let resolve, reject;
const final = new Promise((a, b) => {
  resolve = a;
  reject = b;
});
final.catch(() => {});
const session = runtime.provider().createSession({
  providerConfig: {},
  onTranscript: resolve,
  onError: reject,
});
try {
  await session.connect();
  for (let i = 0; i < audio.length; i += 4096) {
    session.sendAudio(audio.subarray(i, i + 4096));
    do {
      await Promise.all([...pending]);
      await new Promise((r) => setImmediate(r));
    } while (pending.size);
    if (!session.isConnected()) break;
  }
  session.close();
  const text = await final;
  await writeFile(
    output,
    JSON.stringify(
      {
        mode: "offline-diagnostic",
        audioSha256: createHash("sha256").update(audio).digest("hex"),
        records,
        text,
        metrics: runtime.metrics,
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
} finally {
  await runtime.dispose();
}
