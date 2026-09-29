import { test } from "node:test";
import assert from "node:assert/strict";
import plugin from "../dist/index.js";

test("built entry imports the public SDK and registers without starting a worker", async () => {
  let provider, dispose, lifecycle;
  assert.equal(plugin.id, "faster-whisper-transcription");
  await plugin.register({
    pluginConfig: {
      python: "/not-provisioned/python",
      modelPath: "/not-provisioned/model",
    },
    lifecycle: {
      onDispose: (fn) => {
        dispose = fn;
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
  assert.equal(provider.isConfigured(), false);
  assert.equal(lifecycle.id, plugin.id);
  assert.equal(typeof dispose, "function");
  await dispose();
  await lifecycle.dispose();
});
