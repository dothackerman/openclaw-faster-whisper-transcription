import { existsSync } from "node:fs";
import type { RealtimeTranscriptionProviderPlugin } from "openclaw/plugin-sdk/plugin-entry";
import { PROVIDER, type Config } from "./config.js";
import { Worker, type Decoder } from "./worker.js";
import {
  AUDIO_BYTES_PER_SECOND,
  WINDOW_SECONDS,
  OVERLAP_SECONDS,
  QUEUE_SECONDS,
  SESSION_SECONDS,
} from "./limits.js";
import { endpoint } from "./endpoint.js";
import { Stitcher } from "./stitch.js";

type Request = Parameters<
  RealtimeTranscriptionProviderPlugin["createSession"]
>[0];
type Session = ReturnType<RealtimeTranscriptionProviderPlugin["createSession"]>;
export class Runtime {
  metrics = {
    windows: 0,
    maxQueuedSeconds: 0,
    maxLagSeconds: 0,
    decodeMs: [] as number[],
    anchors: 0,
    gaps: 0,
    receivedSeconds: 0,
  };
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
    let buffer = Buffer.alloc(0),
      length = 0,
      offset = 0,
      total = 0,
      decodedEnd = 0;
    let busy = false,
      loaded = false;
    const stitch = new Stitcher();
    const windowBytes = WINDOW_SECONDS * AUDIO_BYTES_PER_SECOND;
    const strideBytes =
      (WINDOW_SECONDS - OVERLAP_SECONDS) * AUDIO_BYTES_PER_SECOND;
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
      stitch.clear();
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
      const text = stitch.text();
      finish();
      request.onTranscript?.(text);
    };
    const pump = () => {
      if (!loaded || busy || (state !== "open" && state !== "closing")) return;
      if (state === "closing" && decodedEnd === total) {
        publishFinal();
        return;
      }
      const cut = endpoint(buffer, length);
      if (state === "open" && !cut) return;
      busy = true;
      const size = cut?.size ?? Math.min(length, windowBytes),
        start = offset;
      const advance = cut?.advance ?? Math.min(strideBytes, size);
      const snapshot = Buffer.from(buffer.subarray(0, size));
      const started = performance.now();
      void this.decoder!.decodeWindow(snapshot)
        .then((words) => {
          if (state === "done") return;
          stitch.add(
            words,
            start / AUDIO_BYTES_PER_SECOND,
            (start + size) / AUDIO_BYTES_PER_SECOND,
          );
          decodedEnd = start + size;
          this.metrics.windows++;
          this.metrics.decodeMs.push(performance.now() - started);
          this.metrics.anchors = stitch.anchors;
          this.metrics.gaps = stitch.gaps;
          // Keep overlap for the next decode, including audio arriving in flight.
          const consumed = advance;
          buffer.copyWithin(0, consumed, length);
          buffer.fill(0, length - consumed, length);
          length -= consumed;
          offset += consumed;
          // No onPartial: stock Stop would commit a stale prefix immediately.
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
      if (state !== "open" && !(state === "connecting" && length > 0)) {
        fail(new Error("Faster-Whisper session closed before ready"));
        return;
      }
      state = "closing";
      finalTimer = setTimeout(
        () =>
          fail(
            new Error(
              "Faster-Whisper finalization exceeded the OpenClaw drain budget; no complete transcript is available",
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
        this.metrics = {
          windows: 0,
          maxQueuedSeconds: 0,
          maxLagSeconds: 0,
          decodeMs: [],
          anchors: 0,
          gaps: 0,
          receivedSeconds: 0,
        };
        buffer = Buffer.alloc(QUEUE_SECONDS * AUDIO_BYTES_PER_SECOND);
        lifetime = setTimeout(
          () =>
            fail(
              new Error(
                "Faster-Whisper reached the 60-minute safety ceiling; no complete transcript is available",
              ),
            ),
          SESSION_SECONDS * 1000,
        );
        connectPromise = (async () => {
          try {
            await this.stopping;
            if (
              (state !== "connecting" && state !== "closing") ||
              this.disposed
            )
              throw new Error("Faster-Whisper session cancelled");
            this.decoder ??= this.factory((e) => this.active?.abort(e));
            await this.decoder.start();
            if (state !== "connecting" && state !== "closing")
              throw new Error("Faster-Whisper session cancelled");
            loaded = true;
            if (state === "connecting") state = "open";
            pump();
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
        if (state !== "open" && state !== "connecting") return;
        if (!Buffer.isBuffer(audio)) {
          fail(new Error("Invalid Faster-Whisper audio frame"));
          return;
        }
        if (total + audio.length >= SESSION_SECONDS * AUDIO_BYTES_PER_SECOND) {
          fail(
            new Error(
              "Faster-Whisper reached the 60-minute safety ceiling; no complete transcript is available",
            ),
          );
          return;
        }
        if (length + audio.length > buffer.length) {
          fail(
            new Error(
              "Faster-Whisper cannot keep up with incoming audio; no complete transcript is available",
            ),
          );
          return;
        }
        audio.copy(buffer, length);
        length += audio.length;
        total += audio.length;
        this.metrics.receivedSeconds = total / AUDIO_BYTES_PER_SECOND;
        this.metrics.maxQueuedSeconds = Math.max(
          this.metrics.maxQueuedSeconds,
          length / AUDIO_BYTES_PER_SECOND,
        );
        this.metrics.maxLagSeconds = Math.max(
          this.metrics.maxLagSeconds,
          (total - decodedEnd) / AUDIO_BYTES_PER_SECOND,
        );
        pump();
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
