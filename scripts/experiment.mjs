// Provider-path evaluation; results are LOCAL by default. No Gateway or credentials.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const [
  profilePath,
  manifestPath = "fixtures/public/manifest.json",
  output = ".local/run.json",
  repeatsArg = "3",
] = process.argv.slice(2);
if (!profilePath)
  throw new Error(
    "Usage: node scripts/experiment.mjs PROFILE MANIFEST OUTPUT REPEATS",
  );
const repeats = Number(repeatsArg);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20)
  throw new Error("repeats must be 1..20");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const manifestBytes = await readFile(manifestPath),
  manifest = JSON.parse(manifestBytes);
const config = parseConfig(JSON.parse(await readFile(profilePath, "utf8")));
async function hashFile(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
await mkdir(dirname(resolve(output)), { recursive: true, mode: 0o700 });
const metadata = {
  version: 1,
  utc: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty: !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim(),
  harnessSha256: await hashFile(new URL(import.meta.url)),
  workerSha256: await hashFile(new URL("../python/worker.py", import.meta.url)),
  manifestSha256: hash(manifestBytes),
  modelSha256: await hashFile(resolve(config.modelPath, "model.bin")),
  gpuIdentity: execFileSync(
    "nvidia-smi",
    ["--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
    { encoding: "utf8" },
  ).trim(),
  versions: execFileSync(config.python, ["-m", "pip", "freeze"], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", PIP_DISABLE_PIP_VERSION_CHECK: "1" },
  }),
  config,
  seed: 7419,
  baselineSeconds: 5,
  plannedRows: manifest.fixtures.length * repeats,
};
await writeFile(
  output,
  JSON.stringify({ ...metadata, incomplete: true, rows: [] }) + "\n",
  { flag: "wx", mode: 0o600 },
);
const telemetry = [];
let pending = "";
const gpu = spawn(
  "nvidia-smi",
  [
    "--query-gpu=memory.used,utilization.gpu,power.draw,temperature.gpu",
    "--format=csv,noheader,nounits",
    "-lms",
    "200",
  ],
  { stdio: ["ignore", "pipe", "ignore"] },
);
let telemetryAvailable = true;
gpu.on("error", () => {
  telemetryAvailable = false;
});
gpu.stdout.on("data", (chunk) => {
  pending += chunk;
  const lines = pending.split("\n");
  pending = lines.pop();
  for (const line of lines) {
    if (telemetry.length < 20000)
      telemetry.push({
        ms: performance.now(),
        values: line.split(",").map((x) => Number(x.trim())),
      });
  }
});
const runtime = new Runtime(config);
const rows = [];
await mkdir(dirname(resolve(output)), { recursive: true, mode: 0o700 });
const started = performance.now();
let baselineEnd;
async function checkpoint(incomplete) {
  const baseline = telemetry.filter((x) => x.ms < baselineEnd);
  const mem = telemetry.map((x) => x.values[0]).filter(Number.isFinite);
  const artifact = {
    ...metadata,
    incomplete,
    telemetryAvailable: telemetryAvailable && telemetry.length > 0,
    baselineMemoryMiB: baseline.length
      ? baseline.reduce((sum, x) => sum + x.values[0], 0) / baseline.length
      : null,
    peakMemoryMiB: mem.length ? Math.max(...mem) : null,
    elapsedMs: performance.now() - started,
    rows,
    telemetry,
  };
  await writeFile(output + ".tmp", JSON.stringify(artifact, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(output + ".tmp", output);
}
try {
  await sleep(5000);
  baselineEnd = performance.now();
  // Fixed seeded permutation; paired candidate profiles use the same order.
  let seed = 7419;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let repeat = 0; repeat < repeats; repeat++) {
    const order = [...manifest.fixtures];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const fixture of order) {
      const audio = await readFile(
        resolve(dirname(manifestPath), fixture.file),
      );
      if (hash(audio) !== fixture.sha256)
        throw new Error("Fixture hash mismatch");
      let firstPartial = null,
        stoppedAt,
        firstAudio,
        finish,
        fail,
        previous = "";
      let churn = 0;
      const completion = new Promise((res, rej) => {
        finish = res;
        fail = rej;
      });
      completion.catch(() => {});
      const start = performance.now();
      const session = runtime.provider().createSession({
        providerConfig: {},
        onPartial: (text) => {
          if (text && firstPartial === null)
            firstPartial = performance.now() - firstAudio;
          if (text) {
            let common = 0;
            const a = previous.split(/\s+/),
              b = text.split(/\s+/);
            while (
              a[common] === b[common] &&
              common < Math.min(a.length, b.length)
            )
              common++;
            if (previous) churn += a.length - common;
            previous = text;
          }
        },
        onTranscript: (text) => finish({ text, at: performance.now() }),
        onError: fail,
      });
      let row = {
        fixture: fixture.id,
        language: fixture.language,
        mic: fixture.mic,
        repeat,
        sha256: fixture.sha256,
        seconds: audio.length / 8000,
        cold: rows.length === 0,
        start,
      };
      try {
        await session.connect();
        row.readyMs = performance.now() - start;
        firstAudio = performance.now();
        for (let i = 0; i < audio.length; i += 800) {
          session.sendAudio(audio.subarray(i, i + 800));
          const wait =
            firstAudio +
            Math.min(i + 800, audio.length) / 8 -
            performance.now();
          if (wait > 0) await sleep(wait);
          if (!session.isConnected()) break;
        }
        stoppedAt = performance.now();
        session.close();
        const result = await completion;
        row = {
          ...row,
          status: "ok",
          text: result.text,
          reference: fixture.reference,
          firstPartialMs: firstPartial,
          finalMs: result.at - stoppedAt,
          partialRetractedWords: churn,
          end: result.at,
        };
      } catch (error) {
        session.close();
        row = {
          ...row,
          status: "error",
          error: error.message,
          end: performance.now(),
        };
      }
      rows.push(row);
      await checkpoint(true);
      console.log(
        JSON.stringify({
          fixture: fixture.id,
          repeat,
          status: row.status,
          readyMs: row.readyMs,
          firstPartialMs: row.firstPartialMs,
          finalMs: row.finalMs,
        }),
      );
    }
  }
} finally {
  await runtime.dispose();
  await sleep(2000);
  gpu.kill();
  await checkpoint(rows.length !== metadata.plannedRows);
}
