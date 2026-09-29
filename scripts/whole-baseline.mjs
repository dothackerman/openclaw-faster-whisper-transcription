// Evaluation-only full-utterance comparator, bounded to the 30s wire limit.
// Uses the same sidecar/model/decoding defaults, without timestamps/chunk stitching.
import { Worker } from "../dist/worker.js";
import { MAX_AUDIO_BYTES } from "../dist/limits.js";
export class WholeBaseline {
  constructor(config) {
    this.config = config;
    this.worker = new Worker(config, () => {});
  }
  provider() {
    return {
      createSession: (request) => {
        let audio = Buffer.alloc(0),
          connected = false,
          timer;
        return {
          connect: async () => {
            await this.worker.start();
            connected = true;
          },
          isConnected: () => connected,
          sendAudio: (frame) => {
            if (audio.length + frame.length > MAX_AUDIO_BYTES)
              throw Error("Baseline exceeds per-request bound");
            audio = Buffer.concat([audio, frame]);
          },
          close: () => {
            if (!connected) return;
            connected = false;
            timer = setTimeout(() => {
              void this.worker.stop();
              request.onError(Error("Baseline final deadline exceeded"));
            }, this.config.finalTimeoutMs);
            void this.worker
              .decode(audio)
              .then(
                (text) => request.onTranscript(text),
                (e) => request.onError(e),
              )
              .finally(() => {
                clearTimeout(timer);
                audio.fill(0);
              });
          },
        };
      },
    };
  }
  async dispose() {
    await this.worker.stop();
  }
}
