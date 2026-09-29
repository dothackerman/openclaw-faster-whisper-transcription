import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Config } from "./config.js";
import { MAX_AUDIO_BYTES, MAX_REQUEST_BYTES } from "./limits.js";

import type { Word } from "./stitch.js";
type Result = { text: string; words: Word[] };
export interface Decoder {
  start(): Promise<void>;
  decodeWindow(audio: Buffer): Promise<Word[]>;
  stop(): Promise<void>;
}
// One request in flight; no unbounded readline accumulator or writable queue.
export class Worker implements Decoder {
  private child?: ChildProcessWithoutNullStreams;
  private pending?: {
    resolve: (v: Result) => void;
    duration: number;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  };
  private output = Buffer.alloc(0);
  private exit?: Promise<void>;
  private stopping = false;
  constructor(
    private config: Config,
    private onCrash: (e: Error) => void,
  ) {}
  async start(): Promise<void> {
    if (this.child) return;
    this.stopping = false;
    const env: NodeJS.ProcessEnv = {
      PATH: "/usr/bin:/bin",
      LANG: "C.UTF-8",
      PYTHONUNBUFFERED: "1",
      HF_HUB_OFFLINE: "1",
      TRANSFORMERS_OFFLINE: "1",
      OMP_NUM_THREADS: "2",
    };
    const child = spawn(
      this.config.python,
      ["-I", fileURLToPath(new URL("../python/worker.py", import.meta.url))],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env,
      },
    );
    this.child = child;
    this.exit = new Promise((resolve) =>
      child.once("close", () => {
        if (this.child === child) this.child = undefined;
        this.rejectPending(new Error("Faster-Whisper worker exited"));
        if (!this.stopping)
          this.onCrash(
            new Error("Faster-Whisper worker exited; start a new dictation"),
          );
        resolve();
      }),
    );
    child.on("error", () =>
      this.fail(
        "Faster-Whisper worker could not start; check the dedicated runtime",
      ),
    );
    child.stdin.on("error", () =>
      this.fail("Faster-Whisper worker input failed"),
    );
    // Native libraries may write sensitive diagnostics. Drain, never log or retain.
    child.stderr.on("data", () => {});
    child.stdout.on("data", (chunk: Buffer) => {
      if (this.output.length + chunk.length > 65536)
        return this.fail("Faster-Whisper response exceeded limit");
      this.output = Buffer.concat([this.output, chunk]);
      const end = this.output.indexOf(10);
      if (end < 0) return;
      const line = this.output.subarray(0, end);
      this.output = this.output.subarray(end + 1);
      try {
        const data: unknown = JSON.parse(line.toString("utf8"));
        if (!data || typeof data !== "object" || !("ok" in data))
          throw new Error();
        if ("error" in data) {
          this.fail(
            data.error === "gpu_oom"
              ? "Faster-Whisper GPU out of memory; free VRAM or choose a smaller model"
              : "Faster-Whisper inference failed; check runtime/model compatibility",
          );
          return;
        }
        if (
          data.ok !== true ||
          !("text" in data) ||
          typeof data.text !== "string" ||
          data.text.length > 16000 ||
          this.output.length !== 0 ||
          !this.pending
        )
          throw new Error();
        const pending = this.pending;
        const words = "words" in data ? data.words : undefined;
        if (!Array.isArray(words) || words.length > 512) throw new Error();
        let previous = 0;
        for (const w of words) {
          if (
            !w ||
            typeof w.text !== "string" ||
            w.text.length > 1000 ||
            !Number.isFinite(w.start) ||
            !Number.isFinite(w.end) ||
            w.start < previous ||
            w.end < w.start ||
            w.end > pending.duration + 0.1
          )
            throw new Error();
          previous = w.start;
        }
        this.pending = undefined;
        clearTimeout(pending.timer);
        pending.resolve({ text: data.text, words });
      } catch {
        this.fail("Faster-Whisper worker protocol failed");
      }
    });
    await this.request(
      { op: "load", config: this.config },
      this.config.loadTimeoutMs,
    );
  }
  async decode(audio: Buffer): Promise<string> {
    return (await this.decodeResult(audio, false)).text;
  }
  async decodeWindow(audio: Buffer): Promise<Word[]> {
    return (await this.decodeResult(audio, true)).words;
  }
  private decodeResult(audio: Buffer, timestamps: boolean): Promise<Result> {
    if (!audio.length || audio.length > MAX_AUDIO_BYTES)
      return Promise.reject(
        new Error("Faster-Whisper audio exceeded limit or was empty"),
      );
    return this.request(
      { op: "decode", audio: audio.toString("base64"), timestamps },
      this.config.decodeTimeoutMs,
      audio.length / 8000,
    );
  }
  private request(
    payload: unknown,
    timeout: number,
    duration = 0,
  ): Promise<Result> {
    if (!this.child || this.stopping || this.pending)
      return Promise.reject(
        new Error("Faster-Whisper worker unavailable or busy"),
      );
    const line = JSON.stringify(payload) + "\n";
    if (Buffer.byteLength(line) > MAX_REQUEST_BYTES)
      return Promise.reject(new Error("Faster-Whisper request exceeded limit"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail("Faster-Whisper operation timed out"),
        timeout,
      );
      this.pending = { resolve, reject, timer, duration };
      this.child!.stdin.write(line);
    });
  }
  private rejectPending(error: Error): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.reject(error);
    this.pending = undefined;
  }
  private fail(message: string): void {
    if (this.stopping) return;
    this.rejectPending(new Error(message));
    this.onCrash(new Error(message));
    void this.stop();
  }
  async stop(): Promise<void> {
    this.stopping = true;
    this.rejectPending(new Error("Faster-Whisper worker stopped"));
    const child = this.child;
    if (!child) return;
    child.kill("SIGTERM");
    const kill = setTimeout(() => child.kill("SIGKILL"), 500);
    try {
      await this.exit;
    } finally {
      clearTimeout(kill);
      this.output = Buffer.alloc(0);
    }
  }
}
