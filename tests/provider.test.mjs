import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
import { QUEUE_SECONDS, SESSION_SECONDS } from "../dist/limits.js";
const config = parseConfig({ python: "/usr/bin/python3", modelPath: "/tmp" });
const tick = () => new Promise((r) => setImmediate(r));
const word = (text, start = 0, end = start + 0.2) => ({ text, start, end });
function fixture(t, overrides = {}) {
  const jobs = [],
    events = [];
  let starts = 0,
    stops = 0,
    crash;
  const decoder = {
    async start() {
      starts++;
    },
    decodeWindow(audio) {
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
    crash: (e) => crash(e),
    get starts() {
      return starts;
    },
    get stops() {
      return stops;
    },
  };
}
test("serial chunk lane preserves overlap and new tail; only one final", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000, 1));
  f.session.sendAudio(Buffer.alloc(24000, 2));
  assert.equal(f.jobs.length, 1);
  f.session.close();
  f.session.close();
  f.jobs[0].resolve([word("prefix", 1), word("boundary", 15)]);
  await tick();
  assert.deepEqual(f.events, []);
  assert.equal(f.jobs.length, 2);
  assert.equal(f.jobs[1].audio.length, 56000);
  assert.ok(f.jobs[1].audio.subarray(0, 32000).every((b) => b === 1));
  assert.ok(f.jobs[1].audio.subarray(32000).every((b) => b === 2));
  f.jobs[1].resolve([word("boundary", 3), word("final tail", 6)]);
  await tick();
  assert.deepEqual(f.events, [["final", "prefix boundary final tail"]]);
  f.session.sendAudio(Buffer.alloc(8));
  assert.equal(f.jobs.length, 2);
});
test("Stop at an already decoded boundary does not redundantly decode overlap", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("complete", 15)]);
  await tick();
  assert.deepEqual(f.events, []);
  f.session.close();
  assert.deepEqual(f.events, [["final", "complete"]]);
  assert.equal(f.jobs.length, 1);
});
test("short tail uses one decode and empty close uses none", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(1234));
  assert.equal(f.jobs.length, 0);
  f.session.close();
  assert.equal(f.jobs[0].audio.length, 1234);
  f.jobs[0].resolve([word("short", 0, 0.1)]);
  await tick();
  assert.equal(f.events[0][1], "short");
  const other = f.runtime.provider().createSession({
    providerConfig: {},
    onTranscript: (text) => assert.equal(text, ""),
  });
  await other.connect();
  other.close();
  assert.equal(f.jobs.length, 1);
  assert.equal(f.starts, 2);
});
test("queue overload fails closed without publishing retained prefix", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("prefix")]);
  await tick();
  f.session.sendAudio(Buffer.alloc(QUEUE_SECONDS * 8000));
  assert.match(f.events[0][1], /cannot keep up/);
  assert.equal(f.events.length, 1);
  assert.equal(f.stops, 1);
});
test("backlog drains serially under the one final budget", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(32 * 8000));
  f.session.close();
  for (let i = 0; i < 3; i++) {
    assert.equal(f.jobs.length, i + 1);
    f.jobs[i].resolve([]);
    await tick();
  }
  assert.deepEqual(f.events, [["final", ""]]);
  assert.equal(f.runtime.metrics.windows, 3);
});
test("final deadline kills in-flight decode and suppresses late success", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t, { finalTimeoutMs: 100 });
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(800));
  f.session.close();
  t.mock.timers.tick(101);
  assert.match(f.events[0][1], /drain budget/);
  f.jobs[0].resolve([word("late")]);
  await tick();
  assert.equal(f.events.length, 1);
  assert.equal(f.stops, 1);
});
test("pre-ready audio and early Stop drain exact bytes", async (t) => {
  const f = fixture(t);
  let ready;
  f.decoder.start = () => new Promise((r) => (ready = r));
  const connecting = f.session.connect();
  await tick();
  f.session.sendAudio(Buffer.from([1, 2, 3]));
  f.session.close();
  assert.equal(f.jobs.length, 0);
  ready();
  await connecting;
  assert.deepEqual(f.jobs[0].audio, Buffer.from([1, 2, 3]));
  f.jobs[0].resolve([]);
  await tick();
  assert.deepEqual(f.events, [["final", ""]]);
});
test("cold load shares final deadline and cannot resurrect cancelled session", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t, { finalTimeoutMs: 100 });
  let ready;
  f.decoder.start = () => new Promise((r) => (ready = r));
  const connecting = f.session.connect();
  const rejected = assert.rejects(connecting, /cancelled/);
  await tick();
  f.session.sendAudio(Buffer.alloc(800));
  f.session.close();
  t.mock.timers.tick(101);
  ready();
  await rejected;
  assert.equal(f.jobs.length, 0);
  assert.equal(f.events.length, 1);
});
test("concurrent admission and closing a foreign unconnected session cannot stop owner", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  const other = f.runtime.provider().createSession({ providerConfig: {} });
  await assert.rejects(other.connect(), /another dictation/);
  other.close();
  assert.equal(f.stops, 0);
  assert.ok(f.session.isConnected());
});
test("idle eviction and managed reload dispose owned worker", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t, { idleSeconds: 1 });
  await f.session.connect();
  f.session.close();
  t.mock.timers.tick(1001);
  assert.equal(f.stops, 1);
  const other = f.runtime.provider().createSession({ providerConfig: {} });
  await other.connect();
  await f.runtime.dispose();
  assert.equal(f.stops, 2);
  assert.equal(other.isConnected(), false);
});
test("OOM/crash fails once and never emits late transcript", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.crash(new Error("GPU out of memory"));
  f.jobs[0].resolve([word("late")]);
  await tick();
  assert.deepEqual(f.events, [["error", "GPU out of memory"]]);
});
test("one bounded retry then marked alternatives preserve ambiguous overlap", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("old", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([word("unrelated", 3)]);
  await tick();
  assert.equal(f.jobs.length, 3);
  assert.equal(f.jobs[2].audio.length, 20 * 8000);
  assert.deepEqual(f.events, []);
  f.session.close();
  f.jobs[2].resolve([word("unrelated", 7)]);
  await tick();
  assert.deepEqual(f.events, [
    [
      "final",
      "[uncertain: earlier: old | later: unrelated | retry: unrelated]",
    ],
  ]);
  assert.equal(f.runtime.metrics.retries, 1);
  assert.equal(f.runtime.metrics.uncertaintyMarkers, 1);
});
test("wider-context retry can reconcile once without a marker", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000, 1));
  f.jobs[0].resolve([word("context", 10), word("old", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000, 2));
  f.jobs[1].resolve([word("changed", 3), word("tail", 10)]);
  await tick();
  assert.equal(f.jobs.length, 3);
  assert.ok(f.jobs[2].audio.subarray(0, 64000).every((b) => b === 1));
  assert.ok(f.jobs[2].audio.subarray(64000).every((b) => b === 2));
  f.session.close();
  f.jobs[2].resolve([
    word("context", 2),
    word("old", 7),
    word("changed", 7.3),
    word("tail", 14),
  ]);
  await tick();
  assert.deepEqual(f.events, [["final", "context old changed tail"]]);
  assert.equal(f.runtime.metrics.retries, 1);
  assert.equal(f.runtime.metrics.uncertaintyMarkers, 0);
});
test("disposal during retry suppresses late recovery and stops owned worker", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("old", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([word("changed", 3)]);
  await tick();
  assert.equal(f.jobs.length, 3);
  await f.runtime.dispose();
  f.jobs[2].resolve([word("late", 7)]);
  await tick();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0][0], "error");
  assert.equal(f.stops, 1);
});
test("retry may not silently erase an old negation just because context is wider", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([
    word("context", 10),
    word("not", 13),
    word("approved", 15),
  ]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([word("approved", 3)]);
  await tick();
  f.session.close();
  f.jobs[2].resolve([word("context", 2), word("approved", 7)]);
  await tick();
  assert.deepEqual(f.events, [
    [
      "final",
      "context [uncertain: earlier: not approved | later: approved | retry: approved]",
    ],
  ]);
});
test("short remaining final budget skips retry and preserves a marked final", async (t) => {
  const f = fixture(t, { finalTimeoutMs: 100 });
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("old", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.session.close();
  f.jobs[1].resolve([word("changed", 3)]);
  await tick();
  assert.equal(f.jobs.length, 2);
  assert.equal(f.runtime.metrics.retrySkipped, 1);
  assert.deepEqual(f.events, [
    ["final", "[uncertain: earlier: old | later: changed]"],
  ]);
});
test("final deadline also bounds an already running overlap retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t, { finalTimeoutMs: 100 });
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("old", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([word("changed", 3)]);
  await tick();
  assert.equal(f.jobs.length, 3);
  f.session.close();
  t.mock.timers.tick(101);
  f.jobs[2].resolve([word("late", 7)]);
  await tick();
  assert.equal(f.events.length, 1);
  assert.match(f.events[0][1], /drain budget/);
});
test("recovered overlap negation reaches the only final without early prefix publication", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000, 1));
  f.jobs[0].resolve([word("Do", 13), word("send", 14), word("this", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000, 1));
  f.session.close();
  f.jobs[1].resolve([
    word("Do", 1),
    word("not", 1.5),
    word("send", 2),
    word("this", 3),
  ]);
  await tick();
  assert.equal(f.events.length, 1);
  assert.deepEqual(f.events, [["final", "Do not send this"]]);
  assert.equal(f.session.isConnected(), false);
});
test("assembled final exceeds worker per-window text limit without truncation", async (t) => {
  const f = fixture(t);
  const expected = [];
  await f.session.connect();
  for (let i = 0; i < 20; i++) {
    f.session.sendAudio(Buffer.alloc(i === 0 ? 128000 : 96000, 1));
    const text = String(i).padStart(2, "0") + "x".repeat(898);
    expected.push(text);
    assert.equal(f.jobs.length, i + 1);
    f.jobs[i].resolve([word(text, 5)]);
    await tick();
    assert.deepEqual(f.events, []);
  }
  f.session.close();
  const final = expected.join(" ");
  assert.ok(final.length > 16000);
  assert.deepEqual(f.events, [["final", final]]);
});
test("60-minute audio ceiling is independent of queue size and fails without final", async (t) => {
  const f = fixture(t);
  f.decoder.decodeWindow = async () => [];
  await f.session.connect();
  for (let seconds = 4; seconds < SESSION_SECONDS; seconds += 4) {
    f.session.sendAudio(Buffer.alloc(32000, 255));
    await tick();
    assert.ok(f.session.isConnected());
  }
  assert.equal(f.runtime.metrics.receivedSeconds, 3596);
  assert.ok(f.runtime.metrics.maxQueuedSeconds <= 16);
  f.session.sendAudio(Buffer.alloc(32000));
  assert.match(f.events[0][1], /60-minute/);
  assert.equal(f.events.length, 1);
});
test("60-minute wall ceiling also applies during load or stalled capture", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(t);
  await f.session.connect();
  t.mock.timers.tick(SESSION_SECONDS * 1000);
  assert.match(f.events[0][1], /60-minute/);
  assert.equal(f.events.length, 1);
});
test("obsolete short-cap/snapshot config and wrong model are rejected", (t) => {
  assert.throws(
    () => parseConfig({ ...config, maxAudioSeconds: 15 }),
    /Unknown/,
  );
  assert.throws(
    () => parseConfig({ ...config, snapshotIntervalSeconds: 0 }),
    /Unknown/,
  );
  assert.throws(() => parseConfig({ ...config, beamSize: 1.5 }), /integer/);
  const f = fixture(t);
  assert.throws(
    () =>
      f.runtime
        .provider()
        .createSession({ providerConfig: { model: "wrong" } }),
    /Configure/,
  );
});

test("Do/Don't first-word disagreement reaches final as visible alternatives", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("Do", 15), word("agree", 15.3), word("now", 15.6)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([
    word("Don't", 3),
    word("agree", 3.3),
    word("now", 3.6),
    word("tail", 10),
  ]);
  await tick();
  assert.equal(f.jobs.length, 3);
  assert.deepEqual(f.events, []);
  f.session.close();
  f.jobs[2].resolve([
    word("Don't", 7),
    word("agree", 7.3),
    word("now", 7.6),
    word("tail", 14),
  ]);
  await tick();
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0][0], "final");
  assert.match(
    f.events[0][1],
    /earlier: Do agree now \| later: Don't agree now \| retry: Don't agree now/,
  );
  assert.match(f.events[0][1], /\] tail$/);
  assert.equal(f.runtime.metrics.retries, 1);
  assert.equal(f.runtime.metrics.uncertaintyMarkers, 1);
});

test("old-only overlap negation survives bounded retry as a marked final", async (t) => {
  const f = fixture(t);
  await f.session.connect();
  f.session.sendAudio(Buffer.alloc(128000));
  f.jobs[0].resolve([word("Do", 13), word("not", 13.5), word("send", 15)]);
  await tick();
  f.session.sendAudio(Buffer.alloc(96000));
  f.jobs[1].resolve([word("Do", 1), word("send", 3), word("tail", 10)]);
  await tick();
  assert.equal(f.jobs.length, 3);
  assert.deepEqual(f.events, []);
  f.session.close();
  f.jobs[2].resolve([word("Do", 5), word("send", 7), word("tail", 14)]);
  await tick();
  assert.deepEqual(f.events, [
    [
      "final",
      "[uncertain: earlier: Do not send | later: Do send | retry: Do send] tail",
    ],
  ]);
  assert.equal(f.runtime.metrics.retries, 1);
  assert.equal(f.runtime.metrics.uncertaintyMarkers, 1);
});
