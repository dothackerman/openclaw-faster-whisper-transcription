import { test } from "node:test";
import assert from "node:assert/strict";
import { Stitcher } from "../dist/stitch.js";
const w = (text, start, end = start + 0.3) => ({ text, start, end });
test("exact review repro: tied single-word anchors must not delete recovered@5.5", () => {
  const s = new Stitcher();
  s.add([w("alpha", 5), w("anchor", 7)], 0, 8);
  // Next window begins at absolute 4s. Relative 1/1.5/3/4 map to
  // the review's exact absolute alpha@5/recovered@5.5/anchor@7/tail@8.
  assert.throws(
    () =>
      s.add(
        [w("alpha", 1), w("recovered", 1.5), w("anchor", 3), w("tail", 4)],
        4,
        10,
      ),
    /align all words/,
  );
  assert.equal(s.text(), "alpha anchor");
  assert.equal(s.anchors, 0);
});
test("symmetric review repro rejects an unmatched old-only word between matches", () => {
  const s = new Stitcher();
  s.add([w("alpha", 5), w("old-only", 5.5), w("anchor", 7)], 0, 8);
  assert.throws(
    () => s.add([w("alpha", 1), w("anchor", 3), w("tail", 4)], 4, 10),
    /align all words/,
  );
  assert.equal(s.anchors, 0);
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
for (const common of [[w("anchor", 7)], [w("in", 6.6), w("the", 7)]]) {
  test(`a corrected word before later common tokens (${common.map((x) => x.text).join(" ")}) must not revert silently`, () => {
    const s = new Stitcher();
    s.add([w("alpha", 5), w("wrong", 5.5), ...common], 0, 8);
    const fresh = [
      w("alpha", 5),
      w("corrected", 5.5),
      ...common,
      w("tail", 8),
    ].map((word) => ({ ...word, start: word.start - 4, end: word.end - 4 }));
    assert.throws(() => s.add(fresh, 4, 10), /align all words/);
    assert.equal(
      s.text(),
      ["alpha", "wrong", ...common.map((x) => x.text)].join(" "),
    );
    assert.equal(s.anchors, 0);
  });
}
test("a later anchor cannot silently delete a newly recovered overlap negation", () => {
  const s = new Stitcher();
  s.add([w("Do", 6), w("send", 7), w("this", 7.4)], 0, 8);
  assert.throws(
    () =>
      s.add(
        [
          w("Do", 0),
          w("not", 0.5),
          w("send", 1),
          w("this", 1.4),
          w("message", 3),
        ],
        6,
        10,
      ),
    /align all words/,
  );
  assert.equal(s.text(), "Do send this");
  assert.equal(s.anchors, 0);
});
test("an unmatched fresh leading word cannot disappear at a one-word anchor", () => {
  const s = new Stitcher();
  s.add([w("approved", 7)], 0, 8);
  assert.throws(
    () => s.add([w("not", 0.5), w("approved", 1)], 6, 10),
    /align all words/,
  );
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
