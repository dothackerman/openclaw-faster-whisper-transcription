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
      snapshotIntervalSeconds: 2,
      ...overrides,
    }),
    () => ({
      async start() {},
      async stop() {},
      decode(audio) {
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
      session.sendAudio(Buffer.alloc(16000, 255));
      jobs[0].resolve("The prefix");
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
    h.jobs[1].resolve("The prefix and final tail");
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
    assert.equal(h.jobs[1].audio.length, 16003);
    h.jobs[1].resolve("The prefix and final tail");
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
  "duration cap retains accepted text through the actual stock error-stop path",
  { timeout: 4000 },
  async (t) => {
    const h = harness(t, false, {
      maxAudioSeconds: 2,
      snapshotIntervalSeconds: 0,
    });
    assert.equal(h.controller.startDirect(), true);
    await h.created;
    await tick();
    h.sendAudio(Buffer.alloc(16001));
    assert.equal(h.jobs[0].audio.length, 16000);
    h.jobs[0].resolve("Accepted prefix");
    await tick();
    assert.deepEqual(h.commits, [{ text: "Accepted prefix", late: undefined }]);
    assert.equal(h.errors.length, 1);
    assert.match(h.errors[0], /duration limit/);
    assert.ok(h.requests.every((method) => method.startsWith("talk.")));
  },
);
