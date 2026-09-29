import { existsSync } from "node:fs";
import type { RealtimeTranscriptionProviderPlugin } from "openclaw/plugin-sdk/plugin-entry";
import { PROVIDER, type Config } from "./config.js";
import { Worker, type Decoder } from "./worker.js";

type Request = Parameters<
  RealtimeTranscriptionProviderPlugin["createSession"]
>[0];
type Session = ReturnType<RealtimeTranscriptionProviderPlugin["createSession"]>;
export class Runtime {
  private decoder?: Decoder;
  private active?: { abort: (e: Error) => void };
  private idle?: NodeJS.Timeout;
  private disposed = false;
  private stopping?: Promise<void>;
  constructor(
    readonly config: Config,
    private factory = (crash: (e: Error) => void): Decoder =>
      new Worker(config, crash),
  ) {}
  provider(): RealtimeTranscriptionProviderPlugin {
    return {
      id: PROVIDER,
      label: "Local Faster-Whisper",
      defaultModel: this.config.model,
      models: [this.config.model],
      resolveConfig: ({ rawConfig }) => ({
        ...rawConfig,
        model: rawConfig.model ?? this.config.model,
      }),
      isConfigured: () =>
        !this.disposed &&
        existsSync(this.config.python) &&
        existsSync(this.config.modelPath),
      createSession: (request) => this.session(request),
    };
  }
  private session(request: Request): Session {
    if (
      Object.keys(request.providerConfig).some((k) => k !== "model") ||
      (request.providerConfig.model &&
        request.providerConfig.model !== this.config.model)
    )
      throw new Error(
        "Configure Faster-Whisper options and provisioned model in the plugin config",
      );
    let state: "new" | "connecting" | "open" | "closing" | "done" = "new";
    let buffer = Buffer.alloc(0);
    let length = 0,
      decodedLength = 0,
      lastScheduled = 0;
    let lastText = "",
      busy = false,
      speech = false;
    let limitReached = false;
    let finalTimer: NodeJS.Timeout | undefined,
      lifetime: NodeJS.Timeout | undefined;
    let connectPromise: Promise<void> | undefined;
    const owner = { abort: (e: Error) => fail(e) };
    const finish = () => {
      state = "done";
      clearTimeout(finalTimer);
      clearTimeout(lifetime);
      buffer.fill(0);
      buffer = Buffer.alloc(0);
      if (this.active === owner) {
        this.active = undefined;
        this.scheduleIdle();
      }
    };
    const fail = (error: Error) => {
      if (state === "done") return;
      const ownsDecoder = this.active === owner;
      finish();
      if (ownsDecoder) void this.stopDecoder();
      request.onError?.(error);
    };
    const publishFinal = () => {
      const text = lastText;
      finish();
      request.onTranscript?.(text);
      if (limitReached)
        request.onError?.(
          new Error(
            "Faster-Whisper duration limit reached; text up to the limit was retained. Start a new dictation.",
          ),
        );
    };
    const pump = () => {
      if (busy || (state !== "open" && state !== "closing")) return;
      if (state === "closing" && length === decodedLength) {
        publishFinal();
        return;
      }
      if (
        state === "open" &&
        (this.config.snapshotIntervalSeconds === 0 ||
          length - lastScheduled < this.config.snapshotIntervalSeconds * 8000)
      )
        return;
      busy = true;
      const size = length;
      lastScheduled = size;
      const snapshot = Buffer.from(buffer.subarray(0, size));
      void this.decoder!.decode(snapshot)
        .then((text) => {
          if (state === "done") return;
          decodedLength = size;
          lastText = text;
          if (state === "open") {
            if (text && !speech) {
              speech = true;
              request.onSpeechStart?.();
            }
            // Never emit a partial to the stock composer: Stop commits its
            // snapshot immediately and then ignores our asynchronous final.
            // Optional speculative snapshots remain entirely internal.
          }
        })
        .catch((e: unknown) =>
          fail(
            e instanceof Error ? e : new Error("Faster-Whisper decode failed"),
          ),
        )
        .finally(() => {
          snapshot.fill(0);
          busy = false;
          pump();
        });
    };
    const beginClose = () => {
      if (state === "done" || state === "closing") return;
      if (state !== "open") {
        fail(new Error("Faster-Whisper session closed before ready"));
        return;
      }
      state = "closing";
      finalTimer = setTimeout(
        () =>
          fail(
            new Error(
              "Faster-Whisper finalization exceeded the OpenClaw drain budget; final text is unavailable",
            ),
          ),
        this.config.finalTimeoutMs,
      );
      pump();
    };
    return {
      connect: () => {
        if (connectPromise) return connectPromise;
        if (state !== "new" || this.disposed || this.active)
          return Promise.reject(
            new Error(
              "Faster-Whisper is unavailable or another dictation is active",
            ),
          );
        state = "connecting";
        this.active = owner;
        clearTimeout(this.idle);
        buffer = Buffer.alloc(Math.ceil(this.config.maxAudioSeconds * 8000));
        connectPromise = (async () => {
          try {
            await this.stopping;
            if (state !== "connecting" || this.disposed)
              throw new Error("Faster-Whisper session cancelled");
            this.decoder ??= this.factory((e) => this.active?.abort(e));
            await this.decoder.start();
            if (state !== "connecting")
              throw new Error("Faster-Whisper session cancelled");
            state = "open";
            lifetime = setTimeout(
              () =>
                fail(
                  new Error(
                    "Faster-Whisper dictation exceeded its wall-time limit; start a new dictation",
                  ),
                ),
              (this.config.maxAudioSeconds + 30) * 1000,
            );
          } catch (e) {
            const error =
              e instanceof Error
                ? e
                : new Error("Faster-Whisper startup failed");
            fail(error);
            throw error;
          }
        })();
        return connectPromise;
      },
      sendAudio: (audio) => {
        if (state !== "open") return;
        if (!Buffer.isBuffer(audio)) {
          fail(new Error("Invalid Faster-Whisper audio frame"));
          return;
        }
        const accepted = Math.min(audio.length, buffer.length - length);
        audio.copy(buffer, length, 0, accepted);
        length += accepted;
        if (length === buffer.length) {
          limitReached = true;
          beginClose();
        } else pump();
      },
      close: beginClose,
      isConnected: () => state === "open",
    };
  }
  private scheduleIdle(): void {
    clearTimeout(this.idle);
    if (!this.disposed)
      this.idle = setTimeout(() => {
        void this.stopDecoder();
      }, this.config.idleSeconds * 1000);
    this.idle?.unref();
  }
  private stopDecoder(): Promise<void> {
    clearTimeout(this.idle);
    const decoder = this.decoder;
    this.decoder = undefined;
    if (decoder) {
      const stopping = decoder.stop();
      this.stopping = stopping;
      void stopping.finally(() => {
        if (this.stopping === stopping) this.stopping = undefined;
      });
    }
    return this.stopping ?? Promise.resolve();
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    this.active?.abort(new Error("Faster-Whisper plugin is unloading"));
    await this.stopDecoder();
  }
}
