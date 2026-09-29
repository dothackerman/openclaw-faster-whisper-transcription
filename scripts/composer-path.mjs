// In-process stock composer + actual relay + real worker. Microphone/RPC transport
// are simulated; no running Gateway, credentials, or real microphone acceptance.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Runtime } from "../dist/provider.js";
const isolated = await mkdtemp(resolve(tmpdir(), "fw-composer-path-"));
process.env.OPENCLAW_STATE_DIR = isolated;
process.env.OPENCLAW_CONFIG_PATH = resolve(isolated, "openclaw.json");
process.env.OPENCLAW_TEST = "1";
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

const relay = await import(
  pathToFileURL(resolve(source, "src/gateway/talk/transcription-relay.ts")).href
);
const { cleanupTalkConnection } = await import(
  pathToFileURL(resolve(source, "src/gateway/talk/session-registry.ts")).href
);
const pcm = Float32Array.from({ length: 256 }, (_, i) => {
  const u = i ^ 255,
    magnitude = (((u & 15) << 3) + 132) << ((u >> 4) & 7);
  return (u & 128 ? 132 - magnitude : magnitude - 132) / 32768;
});
export class ComposerPathRuntime {
  constructor(config) {
    this.runtime = new Runtime(config);
  }
  get metrics() {
    return { ...this.runtime.metrics, ...this.pathMetrics };
  }
  provider() {
    return {
      createSession: (request) => {
        const listeners = new Set(),
          methods = [];
        const sent = createHash("sha256"),
          received = createHash("sha256");
        let controller,
          active = false,
          sid,
          finalAt,
          finalText,
          stoppedAt,
          failed = false,
          readyResolve,
          readyReject;
        const ready = new Promise((res, rej) => {
          readyResolve = res;
          readyReject = rej;
        });
        ready.catch(() => {});
        const base = this.runtime.provider();
        const provider = {
          ...base,
          createSession: (r) => {
            const session = base.createSession(r);
            return {
              ...session,
              sendAudio: (audio) => {
                received.update(audio);
                session.sendAudio(audio);
              },
            };
          },
        };
        const emit = (payload) => {
          if (payload.type === "ready") readyResolve();
          if (payload.type === "transcript") {
            finalAt = performance.now();
            finalText = payload.text;
          }
          if (payload.type === "error") {
            failed = true;
            readyReject(Error(payload.message));
          }
          for (const listener of listeners)
            listener({ event: "talk.event", payload });
        };
        const client = {
          addEventListener(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
          },
          async request(method, params) {
            methods.push(method);
            if (method === "talk.catalog")
              return {
                transcription: { ready: true },
                modes: ["transcription"],
              };
            if (method === "talk.session.create") {
              const result = relay.createTalkTranscriptionRelaySession({
                context: {
                  getRuntimeConfig: () => ({}),
                  logGateway: { warn: () => {} },
                  broadcastToConnIds: (_event, payload) => emit(payload),
                },
                connId: "synthetic-composer-path",
                provider,
                providerConfig: {},
              });
              sid = result.transcriptionSessionId;
              return { sessionId: sid, audio: result.audio };
            }
            if (method === "talk.session.appendAudio") {
              relay.sendTalkTranscriptionRelayAudio({
                transcriptionSessionId: sid,
                connId: "synthetic-composer-path",
                audioBase64: params.audioBase64,
              });
              return {};
            }
            if (method === "talk.session.close") {
              relay.stopTalkTranscriptionRelaySession({
                transcriptionSessionId: sid,
                connId: "synthetic-composer-path",
              });
              return {};
            }
            throw Error("Unexpected non-dictation RPC");
          },
        };
        return {
          connect: async () => {
            this.pathMetrics = {};
            controller = new ComposerDictationController({
              client,
              connected: true,
              enabled: true,
              dictationAvailable: true,
              realtimeTalkActive: false,
              onCommit: (text, late) => {
                this.pathMetrics = {
                  providerFinalMs: finalAt - stoppedAt,
                  composerInsertMs: performance.now() - stoppedAt,
                  late,
                  onlyTalkRpcs: methods.every((x) => x.startsWith("talk.")),
                  inputHash: sent.digest("hex"),
                  relayHash: received.digest("hex"),
                };
                if (
                  this.pathMetrics.inputHash !== this.pathMetrics.relayHash ||
                  !this.pathMetrics.onlyTalkRpcs
                ) {
                  request.onError(
                    Error("Stock path audio/RPC invariant failed"),
                  );
                  return;
                }
                request.onTranscript(text);
              },
              onError: (message) => {
                failed = true;
                active = false;
                readyReject(Error(message));
                request.onError(Error(message));
              },
              onStateChange: () => {},
            });
            if (!controller.startDirect())
              throw Error("Stock composer refused start");
            await ready;
            active = true;
          },
          isConnected: () => active && !failed,
          sendAudio: (audio) => {
            sent.update(audio);
            const samples = Float32Array.from(audio, (b) => pcm[b]);
            processors.at(-1).onaudioprocess({
              inputBuffer: { getChannelData: () => samples },
            });
          },
          close: () => {
            if (!active) return;
            active = false;
            stoppedAt = performance.now();
            void controller
              .finishActive()
              .then((committed) => {
                if (!committed && !failed) {
                  if (finalText !== "") {
                    request.onError(Error("No stock composer insertion"));
                    return;
                  }
                  this.pathMetrics = {
                    providerFinalMs: finalAt - stoppedAt,
                    composerInsertMs: null,
                    completionMs: performance.now() - stoppedAt,
                    committed: false,
                    onlyTalkRpcs: methods.every((x) => x.startsWith("talk.")),
                    inputHash: sent.digest("hex"),
                    relayHash: received.digest("hex"),
                  };
                  if (
                    this.pathMetrics.inputHash !== this.pathMetrics.relayHash ||
                    !this.pathMetrics.onlyTalkRpcs
                  )
                    request.onError(
                      Error("Stock path audio/RPC invariant failed"),
                    );
                  else request.onTranscript("");
                }
              })
              .finally(() => {
                controller.dispose();
                cleanupTalkConnection("synthetic-composer-path");
              });
          },
        };
      },
    };
  }
  async dispose() {
    cleanupTalkConnection("synthetic-composer-path");
    await this.runtime.dispose();
    await rm(isolated, { recursive: true, force: true });
  }
}
