import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { ID, parseConfig } from "./config.js";
import { Runtime } from "./provider.js";

export default definePluginEntry({
  id: ID,
  name: "Faster-Whisper Transcription",
  description:
    "Local browser dictation with a dedicated Faster-Whisper runtime",
  register(api) {
    const runtime = new Runtime(parseConfig(api.pluginConfig ?? {}));
    api.lifecycle.onDispose?.(() => runtime.dispose());
    api.lifecycle.registerRuntimeLifecycle({
      id: ID,
      dispose: () => runtime.dispose(),
      cleanup: ({ reason, sessionKey, runId }) => {
        if (
          sessionKey === undefined &&
          runId === undefined &&
          (reason === "disable" || reason === "restart")
        )
          return runtime.dispose();
      },
    });
    api.registerRealtimeTranscriptionProvider(runtime.provider());
  },
});
