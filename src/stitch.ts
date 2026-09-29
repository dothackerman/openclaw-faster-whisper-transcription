import { MAX_TRANSCRIPT_CHARS, MAX_TRANSCRIPT_WORDS } from "./limits.js";
export type Word = { text: string; start: number; end: number };
const token = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\s]/gu, "");
// Only the bounded overlap can revise prior words; nothing is published early.
export class Stitcher {
  private words: Word[] = [];
  private end = 0;
  anchors = 0;
  gaps = 0;
  add(relative: Word[], start: number, end: number): void {
    const next = relative.map((w) => ({
      ...w,
      start: w.start + start,
      end: w.end + start,
    }));
    let merged: Word[];
    if (!this.words.length || !next.length) {
      merged = [...this.words, ...next];
    } else {
      const overlap = this.words.findIndex((w) => w.end >= start - 0.25);
      let anchor: [number, number] | undefined;
      let best = Infinity,
        bestRun = 0;
      let previous = new Uint16Array(next.length + 1);
      // Prefer a contiguous time-consistent word sequence over a late common
      // token. A lone "the" must not retain an already-corrected hallucinated tail.
      for (
        let i = Math.max(0, overlap < 0 ? this.words.length : overlap);
        i < this.words.length;
        i++
      ) {
        const old = this.words[i]!;
        const current = new Uint16Array(next.length + 1);
        for (let j = 0; j < next.length && next[j]!.start <= this.end; j++) {
          const fresh = next[j]!;
          const delta = Math.abs(
            (old.start + old.end - fresh.start - fresh.end) / 2,
          );
          if (
            token(old.text) &&
            token(old.text) === token(fresh.text) &&
            delta <= 0.8
          ) {
            const run = previous[j]! + 1;
            current[j + 1] = run;
            if (
              run > bestRun ||
              (run === bestRun &&
                (!anchor || i > anchor[0] || (i === anchor[0] && delta < best)))
            ) {
              anchor = [i, j];
              best = delta;
              bestRun = run;
            }
          }
        }
        previous = current;
      }
      if (anchor) {
        // Every fresh word discarded by this splice must belong to the matched
        // contiguous run. A later anchor alone cannot justify dropping a word
        // newly recovered earlier in the overlap (including a negation).
        if (bestRun !== anchor[1] + 1)
          throw new Error(
            "Faster-Whisper could not align all words at a chunk boundary; no complete transcript is available",
          );
        merged = [
          ...this.words.slice(0, anchor[0] + 1),
          ...next.slice(anchor[1] + 1),
        ];
        this.anchors++;
      } else if (next[0]!.start >= this.words.at(-1)!.end - 0.08) {
        merged = [...this.words, ...next];
        this.gaps++;
      } else {
        throw new Error(
          "Faster-Whisper could not align a chunk boundary; no complete transcript is available",
        );
      }
    }
    if (
      merged.length > MAX_TRANSCRIPT_WORDS ||
      merged.reduce((n, w) => n + w.text.length + 1, 0) > MAX_TRANSCRIPT_CHARS
    )
      throw new Error(
        "Faster-Whisper transcript safety limit exceeded; no complete transcript is available",
      );
    this.words = merged;
    this.end = end;
  }
  text(): string {
    return this.words
      .map((w) => w.text.trim())
      .filter(Boolean)
      .join(" ");
  }
  clear(): void {
    this.words = [];
  }
}
