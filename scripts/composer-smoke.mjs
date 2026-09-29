// Executes the unmodified stock controller/session with fake microphone and RPC.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const source = process.env.OPENCLAW_SOURCE;
assert.ok(source);
const { JSDOM } = createRequire(resolve(source, "package.json"))("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const key of [
  "window",
  "location",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "Event",
  "CustomEvent",
  "DOMException",
  "AbortController",
  "AbortSignal",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const processors = [];
class AudioContext {
  sampleRate = 8000;
  destination = {};
  async close() {}
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  createScriptProcessor() {
    const p = { connect() {}, disconnect() {}, onaudioprocess: null };
    processors.push(p);
    return p;
  }
  createGain() {
    return { connect() {}, disconnect() {}, gain: { value: 1 } };
  }
  createAnalyser() {
    return {
      connect() {},
      disconnect() {},
      getFloatTimeDomainData(a) {
        a.fill(0);
      },
    };
  }
}
globalThis.AudioContext = AudioContext;
Object.defineProperty(navigator, "mediaDevices", {
  value: {
    async getUserMedia() {
      return {
        getTracks: () => [
          Object.assign(new dom.window.EventTarget(), { stop() {} }),
        ],
      };
    },
  },
  configurable: true,
});
const { ComposerDictationController } = await import(
  pathToFileURL(resolve(source, "ui/src/pages/chat/composer-dictation.ts")).href
);
const tick = () => new Promise((r) => setImmediate(r));
function harness(t, injectLegacyPartial = false, overrides = {}) {
  const jobs = [],
    commits = [],
    errors = [],
    requests = [],
    listeners = new Set();
  let session, ready;
  const created = new Promise((r) => {
    ready = r;
  });
  const emit = (payload) => {
    for (const listener of listeners)
      listener({
        event: "talk.event",
        payload: { transcriptionSessionId: "synthetic-session", ...payload },
      });
  };
  const runtime = new Runtime(
    parseConfig({
      python: "/usr/bin/python3",
      modelPath: "/tmp",
      ...overrides,
    }),
    () => ({
      async start() {},
      async stop() {},
      decodeWindow(audio) {
        return new Promise((resolve) =>
          jobs.push({ audio: Buffer.from(audio), resolve }),
        );
      },
    }),
  );
  const client = {
    addEventListener(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async request(method, params) {
      requests.push(method);
      if (method === "talk.catalog")
        return { transcription: { ready: true }, modes: ["transcription"] };
      if (method === "talk.session.create") {
        session = runtime.provider().createSession({
          providerConfig: {},
          onPartial: (text) => emit({ type: "partial", text }),
          onTranscript: (text) =>
            emit({ type: "transcript", text, final: true }),
          onError: (e) => emit({ type: "error", message: e.message }),
        });
        await session.connect();
        ready();
        return {
          sessionId: "synthetic-session",
          audio: { inputEncoding: "g711_ulaw", inputSampleRateHz: 8000 },
        };
      }
      if (method === "talk.session.appendAudio") {
        session.sendAudio(Buffer.from(params.audioBase64, "base64"));
        return {};
      }
      if (method === "talk.session.close") {
        session.close();
        return {};
      }
      throw new Error(`Unexpected RPC ${method}`);
    },
  };
  const controller = new ComposerDictationController({
    client,
    connected: true,
    enabled: true,
    dictationAvailable: true,
    realtimeTalkActive: false,
    onCommit: (text, late) => commits.push({ text, late }),
    onError: (message) => {
      errors.push(message);
      ready();
    },
    onStateChange: () => {},
  });
  t.after(async () => {
    controller.dispose();
    await runtime.dispose();
  });
  return {
    controller,
    jobs,
    commits,
    requests,
    emit,
    created,
    errors,
    sendAudio: (audio) => session.sendAudio(audio),
    async prefix() {
      assert.equal(controller.startDirect(), true);
      await created;
      await tick();
      assert.ok(session, errors.join("; "));
      session.sendAudio(Buffer.alloc(128000, 255));
      jobs[0].resolve([{ text: "The prefix", start: 15, end: 15.2 }]);
      await tick();
      if (injectLegacyPartial) emit({ type: "partial", text: "The prefix" });
      session.sendAudio(Buffer.from([1, 2, 3]));
    },
  };
}
test(
  "stock composer reproduction: a preview causes immediate stale commit and ignores final tail",
  { timeout: 4000 },
  async (t) => {
    const h = harness(t, true);
    await h.prefix();
    assert.equal(await h.controller.finishActive(), true);
    assert.deepEqual(h.commits, [{ text: "The prefix", late: undefined }]);
    await tick();
    h.jobs[1].resolve([
      { text: "The prefix", start: 3, end: 3.2 },
      { text: "and final tail", start: 3.5, end: 4 },
    ]);
    await tick();
    h.emit({ type: "close", reason: "completed" });
    await tick();
    assert.deepEqual(h.commits, [{ text: "The prefix", late: undefined }]);
  },
);
test(
  "P1 regression: patched provider lets stock composer wait and insert the entire final tail",
  { timeout: 4000 },
  async (t) => {
    const h = harness(t);
    await h.prefix();
    const finished = h.controller.finishActive();
    assert.deepEqual(h.commits, []);
    await tick();
    assert.equal(h.jobs[1].audio.length, 32003);
    h.jobs[1].resolve([
      { text: "The prefix", start: 3, end: 3.2 },
      { text: "and final tail", start: 3.5, end: 4 },
    ]);
    await tick();
    // The real relay closes at five seconds; its final callback does not close it.
    assert.deepEqual(h.commits, []);
    h.emit({ type: "close", reason: "completed" });
    assert.equal(await finished, true);
    assert.deepEqual(h.commits, [
      { text: "The prefix and final tail", late: true },
    ]);
    assert.ok(
      h.requests.every((method) => method.startsWith("talk.")),
      "No chat send RPC",
    );
  },
);

test(
  "overload inserts no partial success through stock error-stop",
  { timeout: 4000 },
  async (t) => {
    const h = harness(t);
    await h.prefix();
    h.sendAudio(Buffer.alloc(32 * 8000));
    await tick();
    assert.deepEqual(h.commits, []);
    assert.equal(h.errors.length, 1);
    assert.match(h.errors[0], /cannot keep up/);
    assert.ok(h.requests.every((method) => method.startsWith("talk.")));
  },
);

test(
  "disposing stock composer during pending final suppresses late insertion",
  { timeout: 4000 },
  async (t) => {
    const h = harness(t);
    await h.prefix();
    const finished = h.controller.finishActive();
    await tick();
    h.controller.dispose();
    h.jobs[1].resolve([
      { text: "The prefix", start: 3, end: 3.2 },
      { text: "and final tail", start: 3.5, end: 4 },
    ]);
    await tick();
    h.emit({ type: "close", reason: "completed" });
    assert.equal(await finished, false);
    assert.deepEqual(h.commits, []);
    assert.ok(h.requests.every((method) => method.startsWith("talk.")));
  },
);
