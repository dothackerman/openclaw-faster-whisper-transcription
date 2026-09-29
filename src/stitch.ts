import { MAX_TRANSCRIPT_CHARS, MAX_TRANSCRIPT_WORDS } from "./limits.js";
export type Word = { text: string; start: number; end: number };
export class AlignmentError extends Error {}
const token = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\s]/gu, "");
// Editorial anchors never establish which ASR reading is correct. Hoist only
// exact NFC surfaces unique in each reading, monotone in every reading, and
// (when supplied) within 0.8 s midpoint tolerance across ALL original readings.
// At most 3×512 token positions and 512² pair checks; larger input stays marked.
export function renderUncertainty(
  input: string[][],
  timings?: { start: number; end: number }[][],
): { text: string; markers: number } {
  if (input.length < 1 || input.length > 3)
    throw new Error("Uncertainty rendering requires one to three readings");
  if (
    timings &&
    (timings.length !== input.length ||
      timings.some((r, i) => r.length !== input[i]!.length))
  )
    throw new Error("Uncertainty timing does not cover each surface token");
  const readings = input.map((r) => r.map((text) => text.normalize("NFC")));
  const first = readings[0]!;
  const labels = ["earlier", "later", "retry"];
  const show = (words: string[]) => words.join(" ") || "(no words)";
  let markers = 0;
  const output: string[] = [];
  const emit = (chunks: string[][]) => {
    if (chunks.every((r) => !r.length)) return;
    const choices = new Map<string, { words: string[]; labels: string[] }>();
    chunks.forEach((chunk, index) => {
      const key = JSON.stringify(chunk);
      const choice = choices.get(key);
      if (choice) choice.labels.push(labels[index]!);
      else choices.set(key, { words: chunk, labels: [labels[index]!] });
    });
    output.push(
      `[uncertain: ${[...choices.values()]
        .map((choice) => `${choice.labels.join("/")}: ${show(choice.words)}`)
        .join(" | ")}]`,
    );
    markers++;
  };
  const uniqueReadings = new Set(readings.map((r) => JSON.stringify(r)));
  if (uniqueReadings.size === 1 || readings.some((r) => r.length > 512)) {
    emit(readings);
    // Even empty identical hypotheses can arrive via an ambiguous timed join.
    if (!markers)
      return {
        text: `[uncertain: ${labels.slice(0, readings.length).join("/")}: (no words)]`,
        markers: 1,
      };
    return { text: output.join(" "), markers };
  }
  const indexes = readings.map((r) => {
    const counts = new Map<string, number[]>();
    r.forEach((word, i) => counts.set(word, [...(counts.get(word) ?? []), i]));
    return counts;
  });
  const candidates: { positions: number[]; valid: boolean }[] = [];
  first.forEach((word) => {
    const occurrences = indexes.map((index) => index.get(word));
    if (occurrences.some((positions) => positions?.length !== 1)) return;
    const positions = occurrences.map((p) => p![0]!);
    if (timings) {
      const midpoints = positions.map((pos, i) => {
        const w = timings[i]![pos]!;
        return (w.start + w.end) / 2;
      });
      if (
        midpoints.some((v) => !Number.isFinite(v)) ||
        Math.max(...midpoints) - Math.min(...midpoints) > 0.8
      )
        return;
    }
    candidates.push({ positions, valid: true });
  });
  // Reject BOTH anchors participating in a reorder, rather than arbitrarily
  // choosing one LCS tie and presenting it as agreed surrounding text.
  for (let i = 0; i < candidates.length; i++)
    for (let j = i + 1; j < candidates.length; j++) {
      if (
        candidates[i]!.positions.some(
          (position, r) => position >= candidates[j]!.positions[r]!,
        )
      ) {
        candidates[i]!.valid = false;
        candidates[j]!.valid = false;
      }
    }
  const offsets = readings.map(() => 0);
  for (const candidate of candidates.filter((c) => c.valid)) {
    emit(readings.map((r, i) => r.slice(offsets[i], candidate.positions[i])));
    output.push(first[candidate.positions[0]!]!);
    candidate.positions.forEach((position, i) => {
      offsets[i] = position + 1;
    });
  }
  emit(readings.map((r, i) => r.slice(offsets[i])));
  return { text: output.filter(Boolean).join(" "), markers };
}
// Only the bounded overlap can revise prior words; nothing is published early.
export class Stitcher {
  private words: Word[] = [];
  private end = 0;
  private sealed = "";
  private sealedUntil = -Infinity;
  private sealedWords = 0;
  private sealedReadings: Word[][] = [];
  uncertainties = 0;
  uncertainJoins = 0;
  anchors = 0;
  gaps = 0;
  // Time coverage alone is never proof that a fresh word was already rendered.
  // Keep bounded witnesses for the last seal. Suppression must reconstruct the
  // covered prefix from ONE labeled reading with exact surfaces and timed order.
  // Missing proof is a fatal conflict, not an AlignmentError eligible for marking
  // over immutable text (which would otherwise discard the fresh evidence again).
  private unsealed(words: Word[]): Word[] {
    const covered = words.filter((word) => word.end <= this.sealedUntil);
    if (
      covered.length &&
      !this.sealedReadings.some((reading) => {
        let from = 0;
        for (const word of covered) {
          const matches = reading.flatMap((known, index) =>
            index >= from &&
            known.text.normalize("NFC") === word.text.normalize("NFC") &&
            Math.abs((known.start + known.end - word.start - word.end) / 2) <=
              0.8
              ? [index]
              : [],
          );
          if (matches.length !== 1) return false;
          from = matches[0]! + 1;
        }
        return true;
      })
    )
      throw new Error(
        "Faster-Whisper received conflicting words inside a sealed overlap; no complete transcript is available",
      );
    return words.filter((word) => word.end > this.sealedUntil);
  }
  add(relative: Word[], start: number, end: number): void {
    const next = this.unsealed(
      relative.map((w) => ({
        ...w,
        start: w.start + start,
        end: w.end + start,
      })),
    );
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
        // Timed corroboration identifies the seam, not the correct reading.
        // A changed first word may invert meaning (Do / Don't); retain both
        // through the provider's bounded retry/uncertainty path.
        if (!bestExact)
          throw new AlignmentError(
            "Faster-Whisper chunk boundary has competing first words",
          );
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
          throw new AlignmentError(
            "Faster-Whisper could not align all words at a chunk boundary; no complete transcript is available",
          );
        // The splice replaces the entire old suffix, not just the anchor.
        // Every lexical word it would discard must survive in fresh order at
        // plausible times. New-only words are allowed; old-only deletions or
        // substitutions (including negation) require visible reconciliation.
        let freshFrom = 1;
        for (const old of this.words.slice(anchor + 1)) {
          if (!token(old.text)) continue;
          const retained = next.findIndex(
            (word, i) => i >= freshFrom && exact(old, word),
          );
          if (retained < 0)
            throw new AlignmentError(
              "Faster-Whisper chunk boundary has competing overlap words",
            );
          freshFrom = retained + 1;
        }
        merged = [...this.words.slice(0, anchor + 1), ...next.slice(1)];
        this.anchors++;
      } else if (next[0]!.start >= this.words.at(-1)!.end - 0.08) {
        merged = [...this.words, ...next];
        this.gaps++;
      } else {
        throw new AlignmentError(
          "Faster-Whisper could not align a chunk boundary; no complete transcript is available",
        );
      }
    }
    if (
      this.sealedWords + merged.length > MAX_TRANSCRIPT_WORDS ||
      this.sealed.length + merged.reduce((n, w) => n + w.text.length + 1, 0) >
        MAX_TRANSCRIPT_CHARS
    )
      throw new Error(
        "Faster-Whisper transcript safety limit exceeded; no complete transcript is available",
      );
    this.words = merged;
    this.end = end;
  }
  text(): string {
    return [
      this.sealed,
      this.words
        .map((w) => w.text.trim())
        .filter(Boolean)
        .join(" "),
    ]
      .filter(Boolean)
      .join(" ");
  }
  markUncertain(
    relative: Word[],
    start: number,
    end: number,
    retry?: { words: Word[]; start: number },
  ): void {
    const absolute = relative.map((w) => ({
      ...w,
      start: w.start + start,
      end: w.end + start,
    }));
    const uncertainStart = Math.max(start, this.sealedUntil);
    const before = this.words.filter((w) => w.end <= uncertainStart);
    const old = this.words.filter((w) => w.end > uncertainStart);
    const active = this.unsealed(absolute);
    const retryAll = retry?.words.map((w) => ({
      ...w,
      start: w.start + retry.start,
      end: w.end + retry.start,
    }));
    const retryAbsolute = retryAll
      ? this.unsealed(retryAll).filter((w) => w.end > uncertainStart)
      : undefined;
    // Crossing words belong to the alternative, never to a definite suffix.
    // Extend the sealed region through the connected overlap (including retry)
    // so later windows cannot reinsert a word already committed in that marker.
    let seamEnd = this.end;
    const connected = [...old, ...active, ...(retryAbsolute ?? [])].sort(
      (a, b) => a.start - b.start,
    );
    for (const w of connected) {
      if (w.start >= seamEnd) break;
      seamEnd = Math.max(seamEnd, w.end);
    }
    const fresh = active.filter((w) => w.start < seamEnd);
    const tail = active.filter((w) => w.start >= seamEnd);
    const render = (words: Word[]) =>
      words
        .map((w) => w.text.trim())
        .filter(Boolean)
        .join(" ");
    // A provider Word is an atomic surface plus its original absolute interval.
    // Splitting it invents independently alignable pieces and can turn only part
    // of a disputed word object into apparently agreed text.
    const readings = [old, fresh];
    if (retryAbsolute)
      readings.push(retryAbsolute.filter((w) => w.start < seamEnd));
    const compact = renderUncertainty(
      readings.map((r) => r.map((w) => w.text)),
      readings,
    );
    const sealed = [this.sealed, render(before), compact.text]
      .filter(Boolean)
      .join(" ");
    const sealedWords = sealed.split(/\s+/).length;
    if (
      sealed.length + tail.reduce((n, w) => n + w.text.length + 1, 0) >
        MAX_TRANSCRIPT_CHARS ||
      sealedWords + tail.length > MAX_TRANSCRIPT_WORDS
    )
      throw new Error(
        "Faster-Whisper transcript safety limit exceeded; no complete transcript is available",
      );
    // At most three × 512 Word witnesses. Older unsupported evidence fails
    // explicitly rather than trusting a timestamp-only suppression frontier.
    this.sealedReadings = [
      [...before, ...old],
      absolute,
      ...(retryAll ? [retryAll] : []),
    ].map((reading) => reading.filter((w) => w.start < seamEnd).slice(-512));
    this.sealed = sealed;
    this.sealedWords = sealedWords;
    this.sealedUntil = Math.max(this.sealedUntil, seamEnd);
    this.words = tail;
    this.end = end;
    this.uncertainties += compact.markers;
    this.uncertainJoins++;
  }
  retryRetainsReadings(
    fresh: Word[],
    start: number,
    retry: Word[],
    retryStart: number,
  ): boolean {
    const candidate = retry.map((w) => ({
      ...w,
      start: w.start + retryStart,
      end: w.end + retryStart,
    }));
    const contains = (reading: Word[]) => {
      let from = 0;
      for (const word of reading) {
        const index = candidate.findIndex(
          (w, i) =>
            i >= from &&
            token(w.text) === token(word.text) &&
            Math.abs((w.start + w.end - word.start - word.end) / 2) <= 0.8,
        );
        if (index < 0) return false;
        from = index + 1;
      }
      return true;
    };
    // More context is not proof that an omitted negation was spurious. Only
    // accept an unmarked retry if both prior readings survive monotonically.
    return (
      contains(this.words.filter((w) => w.end > retryStart)) &&
      contains(
        this.unsealed(
          fresh.map((w) => ({
            ...w,
            start: w.start + start,
            end: w.end + start,
          })),
        ),
      )
    );
  }
  clear(): void {
    this.words = [];
    this.sealed = "";
    this.sealedWords = 0;
    this.sealedUntil = -Infinity;
    this.sealedReadings = [];
  }
}
