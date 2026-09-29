import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
const source = process.env.OPENCLAW_SOURCE;
assert.ok(source);
const isolated = await mkdtemp(resolve(tmpdir(), "fw-loader-"));
process.env.OPENCLAW_STATE_DIR = isolated;
process.env.OPENCLAW_CONFIG_PATH = resolve(isolated, "openclaw.json");
process.env.OPENCLAW_TEST = "1";
const host = (p) => import(pathToFileURL(resolve(source, p)).href);
const { loadPluginRegistryHandle } = await host("src/plugins/loader.ts");
const {
  disposePluginRegistryInstances,
  setActivePluginRegistry,
  clearActivePluginRegistry,
} = await host("src/plugins/runtime.ts");
const cfg = {
  plugins: {
    allow: ["faster-whisper-transcription"],
    load: { paths: [process.cwd()] },
    entries: {
      "faster-whisper-transcription": {
        enabled: true,
        config: {
          python: resolve("tests/fake-worker.py"),
          modelPath: isolated,
        },
      },
    },
  },
  agents: { defaults: { voiceModel: "faster-whisper/medium" } },
};
let registry;
try {
  registry = loadPluginRegistryHandle({
    config: cfg,
    workspaceDir: isolated,
    onlyPluginIds: ["faster-whisper-transcription"],
    cache: false,
    env: process.env,
    throwOnLoadError: true,
  });
  assert.equal(registry.realtimeTranscriptionProviders.length, 1);
  setActivePluginRegistry(registry);
  const {
    buildTalkTranscriptionConfig,
    resolveConfiguredRealtimeTranscriptionProvider,
  } = await host("src/gateway/talk/session-config.ts");
  const selection = buildTalkTranscriptionConfig(cfg);
  assert.equal(selection.provider, "faster-whisper");
  assert.equal(selection.model, "medium");
  const selected = resolveConfiguredRealtimeTranscriptionProvider({
    config: cfg,
    configuredProviderId: selection.provider,
    providerConfigs: selection.providers,
    defaultModel: selection.model,
  });
  assert.equal(selected.provider.id, "faster-whisper");
  assert.equal(selected.providerConfig.model, "medium");
  const session = selected.provider.createSession({
    providerConfig: selected.providerConfig,
  });
  await session.connect();
  await disposePluginRegistryInstances(registry);
  assert.equal(session.isConnected(), false);
  console.log(
    "PASS: actual plugin loader, agents.defaults.voiceModel selection without voice-call, managed instance disposal",
  );
} finally {
  if (registry) await disposePluginRegistryInstances(registry);
  await clearActivePluginRegistry();
  await rm(isolated, { recursive: true, force: true });
}
