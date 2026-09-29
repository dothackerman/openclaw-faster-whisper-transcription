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
      const close = (a: Word, b: Word) =>
        Math.abs((a.start + a.end - b.start - b.end) / 2) <= 0.8;
      const exact = (a: Word | undefined, b: Word | undefined) =>
        Boolean(
          a &&
            b &&
            token(a.text) &&
            token(a.text) === token(b.text) &&
            close(a, b),
        );
      const sameSpan = (a: Word, b: Word) => {
        const shorter = Math.min(a.end - a.start, b.end - b.start);
        return (
          close(a, b) &&
          shorter > 0 &&
          Math.min(a.end, b.end) - Math.max(a.start, b.start) >= shorter / 2
        );
      };
      let anchor: number | undefined;
      let bestExact = false,
        bestRun = 0,
        bestDelta = Infinity;
      // Anchor only the initial fresh prefix, never a later common-token run.
      // Everything after its first word stays fresh, including recovered words.
      for (
        let i = 0;
        i < this.words.length && next[0]!.start <= this.end;
        i++
      ) {
        const old = this.words[i]!;
        if (old.end < start - 0.25) continue;
        const firstExact = exact(old, next[0]);
        const leadingSubstitution =
          !firstExact &&
          Boolean(token(old.text) && token(next[0]!.text)) &&
          sameSpan(old, next[0]!) &&
          exact(this.words[i + 1], next[1]) &&
          exact(this.words[i + 2], next[2]);
        if (!firstExact && !leadingSubstitution) continue;
        let run = 1;
        while (exact(this.words[i + run], next[run])) run++;
        const delta = Math.abs(
          (old.start + old.end - next[0]!.start - next[0]!.end) / 2,
        );
        if (
          anchor === undefined ||
          (firstExact && !bestExact) ||
          (firstExact === bestExact &&
            (run > bestRun || (run === bestRun && delta < bestDelta)))
        ) {
          anchor = i;
          bestExact = firstExact;
          bestRun = run;
          bestDelta = delta;
        }
      }
      if (anchor !== undefined) {
        // Whisper may stretch the first fresh token across earlier words.
        // Reject an isolated old-only word fully in the new audio, separated
        // from that first token by at least 200 ms. Overlapping/near-boundary
        // timestamps are not precise enough to establish a missing word.
        if (
          this.words
            .slice(0, anchor)
            .some(
              (w) => w.start >= start && next[0]!.start - w.end >= 0.2 - 1e-9,
            )
        )
          throw new Error(
            "Faster-Whisper could not align all words at a chunk boundary; no complete transcript is available",
          );
        merged = [...this.words.slice(0, anchor + 1), ...next.slice(1)];
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
