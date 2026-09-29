import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const [profile, output = ".local/duration-screen.json"] = process.argv.slice(2);
const config = parseConfig({
  ...JSON.parse(await readFile(profile, "utf8")),
  maxAudioSeconds: 120,
  snapshotIntervalSeconds: 0,
});
const runtime = new Runtime(config);
const rows = [];
const manifestBytes = await readFile("fixtures/public/manifest.json");
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function hashFile(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
const meta = {
  utc: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  config,
  manifestSha256: hash(manifestBytes),
  harnessSha256: hash(await readFile(new URL(import.meta.url))),
  modelSha256: await hashFile(resolve(config.modelPath, "model.bin")),
  kind: "offline-duration-screen-not-browser-latency",
};
await mkdir(dirname(output), { recursive: true });
try {
  for (let repeat = 0; repeat < 3; repeat++)
    for (const seconds of [15, 30, 60, 120])
      for (const language of ["en", "de"]) {
        const clip = await readFile(
          `fixtures/public/${language}-technical.ulaw`,
        );
        const copies = Math.max(1, Math.floor((seconds * 8000) / clip.length));
        const audio = Buffer.concat(Array(copies).fill(clip));
        let finish, fail;
        const done = new Promise((r, j) => {
          finish = r;
          fail = j;
        });
        done.catch(() => {});
        const session = runtime.provider().createSession({
          providerConfig: {},
          onTranscript: finish,
          onError: fail,
        });
        const start = performance.now();
        let stop;
        const row = {
          repeat,
          targetSeconds: seconds,
          seconds: audio.length / 8000,
          language,
        };
        try {
          await session.connect();
          row.readyMs = performance.now() - start;
          session.sendAudio(audio);
          stop = performance.now();
          session.close();
          const text = await done;
          row.finalMs = performance.now() - stop;
          row.status = "ok";
          row.characters = text.length;
        } catch (e) {
          row.finalMs = stop === undefined ? null : performance.now() - stop;
          row.status = "error";
          row.error = e.message;
        }
        rows.push(row);
        console.log(JSON.stringify(row));
        await writeFile(
          output,
          JSON.stringify({ ...meta, rows }, null, 2) + "\n",
          { mode: 0o600 },
        );
      }
} finally {
  await runtime.dispose();
}
