// Explicit read-only host source imports are test-only, never shipped in plugin code.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const source = process.env.OPENCLAW_SOURCE;
assert.ok(source, "Set OPENCLAW_SOURCE to the exact read-only host checkout");
const isolated = await mkdtemp(resolve(tmpdir(), "fw-contract-"));
process.env.OPENCLAW_STATE_DIR = isolated;
process.env.OPENCLAW_CONFIG_PATH = resolve(isolated, "openclaw.json");
process.env.OPENCLAW_TEST = "1";
const host = (path) => import(pathToFileURL(resolve(source, path)).href);
const { loadPluginManifest } = await host("src/plugins/manifest.ts");
const manifest = loadPluginManifest(process.cwd());
assert.equal(manifest.ok, true);
const { default: entry } = await import("../dist/index.js");
let provider, dispose, lifecycle;
entry.register({
  pluginConfig: {
    python: resolve("tests/fake-worker.py"),
    modelPath: isolated,
  },
  lifecycle: {
    onDispose: (fn) => {
      dispose = fn;
      return () => {};
    },
    registerRuntimeLifecycle: (value) => {
      lifecycle = value;
    },
  },
  registerRealtimeTranscriptionProvider: (value) => {
    provider = value;
  },
});
assert.equal(provider.id, "faster-whisper");
assert.equal(provider.defaultModel, "medium");
assert.equal(provider.isConfigured({ providerConfig: {} }), true);
assert.equal(typeof dispose, "function");
assert.equal(typeof lifecycle.cleanup, "function");
const relay = await host("src/gateway/talk/transcription-relay.ts");
const { cleanupTalkConnection } = await host(
  "src/gateway/talk/session-registry.ts",
);
const events = [];
let resolveReady, resolveFinal;
const ready = new Promise((r) => {
  resolveReady = r;
});
const final = new Promise((r) => {
  resolveFinal = r;
});
const context = {
  getRuntimeConfig: () => ({}),
  logGateway: { warn: () => {} },
  broadcastToConnIds: (event, payload) => {
    events.push(payload);
    if (payload.type === "ready") resolveReady();
    if (payload.type === "transcript" && payload.text) resolveFinal(payload);
  },
};
try {
  const session = relay.createTalkTranscriptionRelaySession({
    context,
    connId: "isolated-contract",
    provider,
    providerConfig: {},
  });
  assert.equal(session.audio.inputEncoding, "g711_ulaw");
  assert.equal(session.audio.inputSampleRateHz, 8000);
  await ready;
  relay.sendTalkTranscriptionRelayAudio({
    transcriptionSessionId: session.transcriptionSessionId,
    connId: "isolated-contract",
    audioBase64: Buffer.alloc(800, 255).toString("base64"),
  });
  const stop = performance.now();
  relay.stopTalkTranscriptionRelaySession({
    transcriptionSessionId: session.transcriptionSessionId,
    connId: "isolated-contract",
  });
  const result = await final;
  assert.equal(result.text, "Synthetic result.");
  assert.equal(result.final, true);
  assert.ok(performance.now() - stop < 4500);
  assert.ok(events.some((e) => e.talkEvent?.type === "transcript.done"));
  let loaded, received, late;
  const lateFinal = new Promise((resolve) => {
    late = resolve;
  });
  const coldRuntime = new Runtime(
    parseConfig({ python: "/usr/bin/python3", modelPath: isolated }),
    () => ({
      start: () =>
        new Promise((resolve) => {
          loaded = resolve;
        }),
      async decodeWindow(audio) {
        received = Buffer.from(audio);
        return [{ text: "Early cold speech", start: 0, end: 0 }];
      },
      async stop() {},
    }),
  );
  try {
    const coldContext = {
      ...context,
      broadcastToConnIds: (_event, payload) => {
        if (payload.type === "transcript" && payload.text) late(payload.text);
      },
    };
    const cold = relay.createTalkTranscriptionRelaySession({
      context: coldContext,
      connId: "isolated-cold",
      provider: coldRuntime.provider(),
      providerConfig: {},
    });
    relay.sendTalkTranscriptionRelayAudio({
      transcriptionSessionId: cold.transcriptionSessionId,
      connId: "isolated-cold",
      audioBase64: Buffer.from([1, 2, 3]).toString("base64"),
    });
    relay.stopTalkTranscriptionRelaySession({
      transcriptionSessionId: cold.transcriptionSessionId,
      connId: "isolated-cold",
    });
    await new Promise((resolve) => setImmediate(resolve));
    loaded();
    assert.equal(await lateFinal, "Early cold speech");
    assert.deepEqual(received, Buffer.from([1, 2, 3]));
  } finally {
    cleanupTalkConnection("isolated-cold");
    await coldRuntime.dispose();
  }
  console.log(
    "PASS: native manifest, SDK entry/lifecycle, actual relay create/audio/close/final contract including frames and Stop before model ready",
  );
} finally {
  cleanupTalkConnection("isolated-contract");
  await dispose();
  await rm(isolated, { recursive: true, force: true });
}
