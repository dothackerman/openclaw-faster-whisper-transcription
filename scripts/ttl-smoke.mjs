// Demonstrate the unmodified host obstacle with a fake clock and no live Gateway.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const source = process.env.OPENCLAW_SOURCE;
assert.ok(source);
const relay = await import(
  pathToFileURL(resolve(source, "src/gateway/talk/transcription-relay.ts")).href
);
test("stock 30-minute expiry removes final-only relay before late final can drain", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100000 });
  const events = [];
  let callbacks,
    closed = 0;
  const provider = {
    id: "synthetic-ttl-proof",
    label: "Synthetic",
    isConfigured: () => true,
    createSession: (r) => {
      callbacks = r;
      return {
        async connect() {},
        sendAudio() {},
        close() {
          closed++;
        },
        isConnected: () => true,
      };
    },
  };
  const result = relay.createTalkTranscriptionRelaySession({
    context: {
      getRuntimeConfig: () => ({}),
      logGateway: { warn() {} },
      broadcastToConnIds: (_event, payload) => events.push(payload),
    },
    connId: "isolated-ttl",
    provider,
    providerConfig: {},
  });
  await Promise.resolve();
  const send = () =>
    relay.sendTalkTranscriptionRelayAudio({
      transcriptionSessionId: result.transcriptionSessionId,
      connId: "isolated-ttl",
      audioBase64: "//8=",
    });
  t.mock.timers.tick(30 * 60 * 1000 - 1);
  send();
  assert.equal(closed, 0);
  t.mock.timers.tick(1);
  assert.equal(closed, 1);
  callbacks.onTranscript("Synthetic delayed final");
  assert.ok(!events.some((e) => e.type === "transcript"));
  assert.ok(events.some((e) => e.type === "close" && e.reason === "completed"));
  assert.throws(send, /Unknown/);
});
