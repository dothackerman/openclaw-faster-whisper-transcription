import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const config = parseConfig({
  python: "/usr/bin/python3",
  modelPath: "/tmp",
  snapshotIntervalSeconds: 2,
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t, overrides = {}) {
  const jobs = [],
    events = [];
  let stops = 0,
    starts = 0,
    crash;
  const decoder = {
    async start() {
      starts++;
    },
    decode(audio) {
      return new Promise((resolve, reject) =>
        jobs.push({ audio: Buffer.from(audio), resolve, reject }),
      );
    },
    async stop() {
      stops++;
    },
  };
  const runtime = new Runtime({ ...config, ...overrides }, (cb) => {
    crash = cb;
    return decoder;
  });
  t.after(() => runtime.dispose());
  const session = runtime.provider().createSession({
    providerConfig: {},
    onPartial: (text) => events.push(["partial", text]),
    onTranscript: (text) => events.push(["final", text]),
    onError: (e) => events.push(["error", e.message]),
  });
  return {
    runtime,
    session,
    jobs,
    events,
    decoder,
    get stops() {
      return stops;
    },
    get starts() {
      return starts;
    },
    crash: (e) => crash(e),
  };
}
test("coalesces internal snapshots, preserves final tail, and closes exactly once", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(16000, 1));
  f.session.sendAudio(Buffer.alloc(16000, 2));
  f.session.sendAudio(Buffer.alloc(100, 3));
  assert.equal(f.jobs.length, 1);
  f.jobs[0].resolve("old preview");
  await tick();
  assert.deepEqual(f.events, []);
  assert.equal(f.jobs.length, 2);
  assert.equal(f.jobs[1].audio.length, 32100);
  f.session.close();
  f.session.close();
  assert.equal(f.session.isConnected(), false);
  f.jobs[1].resolve("complete final");
  await tick();
  assert.deepEqual(f.events, [["final", "complete final"]]);
  f.session.sendAudio(Buffer.alloc(4));
  assert.equal(f.jobs.length, 2);
});
test("close during a speculative snapshot decodes newly arrived tail instead of promoting stale text", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(16000));
  f.session.sendAudio(Buffer.from([1, 2, 3]));
  f.session.close();
  f.jobs[0].resolve("stale");
  await tick();
  assert.equal(f.jobs.length, 2);
  assert.deepEqual(f.jobs[1].audio.subarray(-3), Buffer.from([1, 2, 3]));
  f.jobs[1].resolve("fresh");
  await tick();
  assert.deepEqual(f.events, [["final", "fresh"]]);
});
test("rejects concurrent admission and closing an unconnected session cannot kill the owner", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  const other = f.runtime.provider().createSession({ providerConfig: {} });
  await assert.rejects(other.connect(), /another dictation/);
  other.close();
  assert.equal(f.stops, 0);
  assert.equal(f.session.isConnected(), true);
});
test("duration cap finalizes the accepted prefix before reporting the limit", async (t) => {
  const f = fixture(t, { maxAudioSeconds: 2 });
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(16001));
  assert.equal(f.session.isConnected(), false);
  assert.equal(f.jobs[0].audio.length, 16000);
  f.jobs[0].resolve("Retained text");
  await tick();
  assert.equal(f.events[0][0], "final");
  assert.equal(f.events[0][1], "Retained text");
  assert.equal(f.events[1][0], "error");
  assert.match(f.events[1][1], /limit reached/);
  assert.equal(f.stops, 0);
});
test("final deadline kills worker and never emits a successful final", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(16000));
  f.session.close();
  t.mock.timers.tick(4500);
  assert.equal(f.stops, 1);
  assert.match(f.events[0][1], /drain budget/);
  f.jobs[0].resolve("too late");
  await tick();
  assert.equal(f.events.length, 1);
});
test("idle eviction and reload disposal stop owned worker; next session loads afresh", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  await f.session.connect();
  f.session.close();
  t.mock.timers.tick(120000);
  assert.equal(f.stops, 1);
  const next = f.runtime.provider().createSession({ providerConfig: {} });
  await next.connect();
  assert.equal(f.starts, 2);
  await f.runtime.dispose();
  assert.equal(f.stops, 2);
  await assert.rejects(
    f.runtime.provider().createSession({ providerConfig: {} }).connect(),
    /unavailable/,
  );
});
test("crash/OOM invalidates session without leaking late text", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(16000));
  f.crash(new Error("GPU out of memory"));
  f.jobs[0].reject(new Error("failed"));
  await tick();
  assert.deepEqual(f.events, [["error", "GPU out of memory"]]);
  assert.equal(f.stops, 1);
});
test("connect is idempotent, cancelled load cannot become connected", async (t) => {
  const f = fixture(t);
  let loaded;
  f.decoder.start = () =>
    new Promise((r) => {
      loaded = r;
    });
  const p = f.session.connect();
  assert.equal(p, f.session.connect());
  await tick();
  f.session.close();
  loaded();
  await assert.rejects(p, /cancelled/);
  assert.equal(f.session.isConnected(), false);
});
test("empty close has no inference and warm model is reused", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.close();
  await tick();
  assert.deepEqual(f.events, [["final", ""]]);
  assert.equal(f.jobs.length, 0);
  assert.equal(f.stops, 0);
});
test("config and request model validation prevent silent model substitution", (t) => {
  assert.throws(
    () => parseConfig({ ...config, finalTimeoutMs: 5001 }),
    /Invalid/,
  );
  assert.throws(() => parseConfig({ ...config, beamSize: 1.5 }), /integer/);
  assert.throws(() => parseConfig({ ...config, python: "python" }), /absolute/);
  assert.throws(() => parseConfig({ ...config, extra: true }), /Unknown/);
  const f = fixture(t);
  assert.throws(
    () =>
      f.runtime
        .provider()
        .createSession({ providerConfig: { model: "large-v3" } }),
    /provisioned/,
  );
  assert.deepEqual(f.runtime.provider().models, ["medium"]);
});

test("buffers early relay frames and drains Stop during cold load without losing samples", async (t) => {
  const f = fixture(t);
  let loaded;
  f.decoder.start = () =>
    new Promise((r) => {
      loaded = r;
    });
  const connecting = f.session.connect();
  f.session.sendAudio(Buffer.from([1, 2, 3]));
  await tick();
  f.session.close();
  assert.equal(f.jobs.length, 0);
  loaded();
  await connecting;
  assert.equal(f.jobs.length, 1);
  assert.deepEqual(f.jobs[0].audio, Buffer.from([1, 2, 3]));
  f.jobs[0].resolve("Early speech");
  await tick();
  assert.deepEqual(f.events, [["final", "Early speech"]]);
});
test("cold-load final deadline includes loading and suppresses later ready/final callbacks", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  let loaded;
  f.decoder.start = () =>
    new Promise((r) => {
      loaded = r;
    });
  const connecting = f.session.connect();
  f.session.sendAudio(Buffer.from([1]));
  await tick();
  f.session.close();
  t.mock.timers.tick(4500);
  assert.equal(f.stops, 1);
  loaded();
  await assert.rejects(connecting, /cancelled/);
  assert.equal(f.events.length, 1);
  assert.match(f.events[0][1], /drain budget/);
  assert.equal(f.jobs.length, 0);
});
