import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Worker } from "../dist/worker.js";
import { parseConfig } from "../dist/config.js";
const config = parseConfig({
  python: fileURLToPath(new URL("./fake-worker.py", import.meta.url)),
  modelPath: "/tmp",
});
test("real subprocess protocol serializes requests and shuts down", async (t) => {
  const errors = [];
  const w = new Worker(config, (e) => errors.push(e.message));
  t.after(() => w.stop());
  await w.start();
  const first = w.decode(Buffer.alloc(80));
  await assert.rejects(w.decode(Buffer.alloc(80)), /busy/);
  assert.equal(await first, "Synthetic result.");
  await w.stop();
  assert.deepEqual(errors, []);
});
for (const [model, pattern] of [
  ["crash", /exited/],
  ["oom", /out of memory/],
  ["oversize", /exceeded/],
  ["hang", /timed out/],
  ["bad-time", /protocol failed/],
  ["missing-words", /protocol failed/],
]) {
  test(`worker ${model} is bounded and reported without raw diagnostics`, async (t) => {
    const errors = [];
    const w = new Worker({ ...config, model, decodeTimeoutMs: 100 }, (e) =>
      errors.push(e.message),
    );
    t.after(() => w.stop());
    await w.start();
    await assert.rejects(w.decode(Buffer.alloc(80)), pattern);
    await w.stop();
    assert.ok(errors.length);
    assert.ok(errors.every((e) => !e.includes("synthetic private")));
  });
}
test("cold load timeout terminates subprocess", async (t) => {
  const w = new Worker(
    { ...config, model: "load-hang", loadTimeoutMs: 100 },
    () => {},
  );
  t.after(() => w.stop());
  await assert.rejects(w.start(), /timed out/);
  await w.stop();
});
test("missing executable fails without an unhandled pipe error", async (t) => {
  const w = new Worker(
    { ...config, python: "/tmp/nonexistent-fw-python" },
    () => {},
  );
  t.after(() => w.stop());
  await assert.rejects(w.start(), /could not start|stopped/);
});

test("timestamp protocol rejects partial text coverage without leaking text", async (t) => {
  const errors = [];
  const w = new Worker({ ...config, model: "partial-coverage" }, (e) =>
    errors.push(e.message),
  );
  t.after(() => w.stop());
  await w.start();
  await assert.rejects(w.decodeWindow(Buffer.alloc(8000)), /protocol failed/);
  assert.ok(errors.every((e) => !e.includes("alpha")));
});
test("timestamp coverage tolerates case, punctuation, Unicode and word-piece spacing", async (t) => {
  const w = new Worker({ ...config, model: "coverage-formatting" }, () => {});
  t.after(() => w.stop());
  await w.start();
  assert.equal(
    (await w.decodeWindow(Buffer.alloc(8000)))[0].text,
    "älpha DONT 2",
  );
});
