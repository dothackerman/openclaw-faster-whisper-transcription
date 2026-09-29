import { test } from "node:test";
import assert from "node:assert/strict";
import { Stitcher } from "../dist/stitch.js";
const w = (text, start, end = start + 0.3) => ({ text, start, end });
test("exact review repro: tied single-word anchors must not delete recovered@5.5", () => {
  const s = new Stitcher();
  s.add([w("alpha", 5), w("anchor", 7)], 0, 8);
  // Next window begins at absolute 4s. Relative 1/1.5/3/4 map to
  // the review's exact absolute alpha@5/recovered@5.5/anchor@7/tail@8.
  s.add(
    [w("alpha", 1), w("recovered", 1.5), w("anchor", 3), w("tail", 4)],
    4,
    10,
  );
  assert.equal(s.text(), "alpha recovered anchor tail");
  assert.equal(s.anchors, 1);
});
test("exact symmetric repro: phantom@6 cannot survive fresh coverage starting at 6", () => {
  const s = new Stitcher();
  s.add([w("phantom", 6), w("anchor", 7)], 0, 8);
  // Fresh absolute anchor@7/tail@8 are relative 1/2 in the window at 6s.
  assert.throws(
    () => s.add([w("anchor", 1), w("tail", 2)], 6, 10),
    /align all words/,
  );
  assert.equal(s.anchors, 0);
  assert.equal(s.text(), "phantom anchor"); // Failed add is transactional, not a final.
});
test("isolation guard includes exactly 200 ms but tolerates imprecise nearer timing", () => {
  for (const [oldEnd, rejects] of [
    [6.8, true],
    [6.81, false],
  ]) {
    const s = new Stitcher();
    s.add([w("prior", 6, oldEnd), w("anchor", 7)], 0, 8);
    const add = () => s.add([w("anchor", 1), w("tail", 2)], 6, 10);
    if (rejects) assert.throws(add, /align all words/);
    else {
      add();
      assert.equal(s.text(), "prior anchor tail");
    }
  }
});
test("exact trace #13 retains chair under a broad fresh first-word timestamp", () => {
  const s = new Stitcher();
  const old = [
    ["repairing", 108.88, 109.32],
    ["a", 109.32, 109.56],
    ["chair.", 109.56, 109.74],
    ["We", 110.04, 110.28],
    ["agreed", 110.28, 110.5],
    ["to", 110.5, 110.8],
    ["keep", 110.8, 111.02],
    ["a", 111.02, 111.2],
    ["separate", 111.2, 111.52],
    ["work", 111.52, 111.84],
    ["area", 111.84, 112.04],
    ["for", 112.04, 112.32],
    ["each", 112.32, 112.58],
    ["task.", 112.58, 112.86],
  ];
  const fresh = [
    ["We", 108.98, 110.08],
    ["agreed", 110.08, 110.52],
    ["to", 110.52, 110.82],
    ["keep", 110.82, 111.02],
    ["a", 111.02, 111.18],
    ["separate", 111.18, 111.5],
    ["work", 111.5, 111.82],
    ["area", 111.82, 112.04],
    ["for", 112.04, 112.3],
    ["each", 112.3, 112.58],
    ["task.", 112.58, 112.86],
  ];
  s.add(
    old.map(([text, start, end]) => w(text, start - 96.98, end - 96.98)),
    96.98,
    112.98,
  );
  s.add(
    fresh.map(([text, start, end]) => w(text, start - 108.98, end - 108.98)),
    108.98,
    113.48,
  );
  assert.equal(
    s.text(),
    "repairing a chair. We agreed to keep a separate work area for each task.",
  );
});
test("old suffix after the initial anchor is replaced by the fresh hypothesis", () => {
  const s = new Stitcher();
  s.add([w("alpha", 5), w("old-only", 5.5), w("anchor", 7)], 0, 8);
  s.add([w("alpha", 1), w("anchor", 3), w("tail", 4)], 4, 10);
  assert.equal(s.text(), "alpha anchor tail");
});
test("old-only overlap prefix cannot survive before a fully matching fresh prefix", () => {
  const s = new Stitcher();
  s.add([w("old-only", 4.5), w("alpha", 5), w("anchor", 7)], 0, 8);
  assert.throws(
    () => s.add([w("alpha", 1), w("anchor", 3), w("tail", 4)], 4, 10),
    /align all words/,
  );
  assert.equal(s.anchors, 0);
});
test("old words ending before the next audio window remain valid committed context", () => {
  const s = new Stitcher();
  s.add([w("earlier", 3), w("alpha", 5), w("anchor", 7)], 0, 8);
  s.add([w("alpha", 1), w("anchor", 3), w("tail", 4)], 4, 10);
  assert.equal(s.text(), "earlier alpha anchor tail");
});
test("a left-clipped word is prior context, not wholly observed fresh audio", () => {
  const edge = new Stitcher();
  edge.add(
    [w("behind", 27, 27.34), w("the", 27.34, 27.58), w("table", 27.58, 27.86)],
    0,
    31.16,
  );
  edge.add([w("the", 0, 0.32), w("table", 0.32, 0.7)], 27.16, 31.66);
  assert.equal(edge.text(), "behind the table");
});
for (const common of [[w("anchor", 7)], [w("in", 6.6), w("the", 7)]]) {
  test(`a corrected word before later common tokens (${common.map((x) => x.text).join(" ")}) uses the fresh suffix after its initial anchor`, () => {
    const s = new Stitcher();
    s.add([w("alpha", 5), w("wrong", 5.5), ...common], 0, 8);
    const fresh = [
      w("alpha", 5),
      w("corrected", 5.5),
      ...common,
      w("tail", 8),
    ].map((word) => ({ ...word, start: word.start - 4, end: word.end - 4 }));
    s.add(fresh, 4, 10);
    assert.equal(
      s.text(),
      ["alpha", "corrected", ...common.map((x) => x.text), "tail"].join(" "),
    );
    assert.equal(s.anchors, 1);
  });
}
test("initial prefix preserves a newly recovered overlap negation", () => {
  const s = new Stitcher();
  s.add([w("Do", 6), w("send", 7), w("this", 7.4)], 0, 8);
  s.add(
    [w("Do", 0), w("not", 0.5), w("send", 1), w("this", 1.4), w("message", 3)],
    6,
    10,
  );
  assert.equal(s.text(), "Do not send this message");
});
test("an unmatched fresh leading word cannot disappear at a one-word anchor", () => {
  const s = new Stitcher();
  s.add([w("approved", 7)], 0, 8);
  assert.throws(() => s.add([w("not", 0.5), w("approved", 1)], 6, 10), /align/);
});
test("timestamp anchors join boundary words and retain final punctuation", () => {
  const s = new Stitcher();
  s.add([w("Hello", 1), w("international", 6.8), w("cooper", 7.6)], 0, 8);
  s.add(
    [w("international", 0.8), w("cooperation.", 1.6), w("Finish.", 5)],
    6,
    14,
  );
  assert.equal(s.text(), "Hello international cooperation. Finish.");
  assert.equal(s.anchors, 1);
});
test("leading substitution requires two subsequent exact timed words", () => {
  const s = new Stitcher();
  s.add([w("Wir", 6), w("erklärten", 6.3), w("ihr", 6.7)], 0, 8);
  s.add(
    [w("Wie", 0), w("erklärten", 0.3), w("ihr", 0.7), w("weiter.", 2)],
    6,
    10,
  );
  assert.equal(s.text(), "Wir erklärten ihr weiter.");
  for (const fresh of [
    [w("Wie", 0), w("erklärten", 0.3)],
    [w("Wie", 0.35), w("erklärten", 0.65), w("ihr", 0.95)],
  ]) {
    const rejected = new Stitcher();
    rejected.add([w("Wir", 6), w("erklärten", 6.3), w("ihr", 6.7)], 0, 8);
    assert.throws(() => rejected.add(fresh, 6, 10), /align/);
  }
});
test("exact German trace boundary permits leading Wir/Wie with timed corroboration", () => {
  const s = new Stitcher();
  s.add(
    [
      w("Wir", 156.24, 156.48),
      w("erklärten", 156.48, 156.96),
      w("ihr,", 156.96, 157.18),
    ],
    0,
    160.28,
  );
  s.add(
    [
      w("Wie", 0, 0.2),
      w("erklärten", 0.2, 0.68),
      w("ihr,", 0.68, 0.92),
      w("weiter", 1.16, 1.36),
    ],
    156.28,
    162.1,
  );
  assert.equal(s.text(), "Wir erklärten ihr, weiter");
});
test("saved synthetic trace permits for/four substitution and corrected letter/label tail", () => {
  const s = new Stitcher();
  const old = [
    ["and", 43, 43.2],
    ["the", 43.2, 43.38],
    ["largest", 43.38, 43.72],
    ["for", 43.72, 44],
    ["folded", 44, 44.32],
    ["instructions.", 44.32, 45.16],
    ["Each", 45.16, 45.86],
    ["box", 45.86, 46.1],
    ["received", 46.1, 46.52],
    ["a", 46.52, 46.82],
    ["handwritten", 46.82, 47.14],
    ["letter.", 47.14, 47.14],
  ];
  const fresh = [
    ["the", 43.16, 43.32],
    ["largest", 43.32, 43.72],
    ["four", 43.72, 44.02],
    ["folded", 44.02, 44.34],
    ["instructions.", 44.34, 45.24],
    ["Each", 45.64, 45.84],
    ["box", 45.84, 46.06],
    ["received", 46.06, 46.5],
    ["a", 46.5, 46.78],
    ["handwritten", 46.78, 47.16],
    ["label.", 47.16, 47.6],
  ];
  s.add(
    old.map(([text, start, end]) => w(text, start - 31.16, end - 31.16)),
    31.16,
    47.16,
  );
  s.add(
    fresh.map(([text, start, end]) => w(text, start - 43.16, end - 43.16)),
    43.16,
    48.18,
  );
  assert.equal(
    s.text(),
    "and the largest four folded instructions. Each box received a handwritten label.",
  );
});
test("genuine repetitions at different times are not collapsed by token equality", () => {
  const s = new Stitcher();
  s.add([w("very", 6.2), w("very", 6.8), w("clear", 7.3)], 0, 8);
  s.add(
    [
      w("very", 0.2),
      w("very", 0.8),
      w("clear", 1.3),
      w("very", 3),
      w("clear", 3.5),
    ],
    6,
    14,
  );
  assert.equal(s.text(), "very very clear very clear");
});
test("silence and separated hypotheses have no overlap duplication", () => {
  const s = new Stitcher();
  s.add([w("first", 1)], 0, 8);
  s.add([], 6, 14);
  s.add([w("last", 1)], 12, 20);
  assert.equal(s.text(), "first last");
  assert.equal(s.gaps, 1);
});
test("conflicting active overlap fails closed and transcript bound is explicit", () => {
  const s = new Stitcher();
  s.add([w("eins", 7)], 0, 8);
  assert.throws(() => s.add([w("zwei", 1)], 6, 14), /align/);
  const full = new Stitcher();
  assert.throws(
    () => full.add([w("x".repeat(160001), 0)], 0, 8),
    /safety limit/,
  );
});
test("contiguous overlap agreement removes a hallucinated phrase despite later common tokens", () => {
  const s = new Stitcher();
  const old = [
    "These",
    "are",
    "the",
    "final",
    "words",
    "on",
    "the",
    "recording.",
    "The",
    "final",
    "task",
    "was",
    "to",
    "save",
    "the",
    "draft",
    "report.",
  ];
  s.add(
    old.map((text, i) => w(text, 6 + i * 0.05, 6 + i * 0.05 + 0.04)),
    0,
    8,
  );
  const next = [
    "These",
    "are",
    "the",
    "final",
    "words",
    "of",
    "the",
    "recording.",
    "The",
    "orange",
    "umbrella.",
  ];
  s.add(
    next.map((text, i) => w(text, i * 0.05, i * 0.05 + 0.04)),
    6,
    10,
  );
  assert.equal(
    s.text(),
    "These are the final words of the recording. The orange umbrella.",
  );
});
