import { test } from "node:test";
import assert from "node:assert/strict";
import { Stitcher, renderUncertainty } from "../dist/stitch.js";
const w = (text, start, end = start + 0.3) => ({ text, start, end });
test("uncertainty retains missing negation and phantom alternatives through later windows", () => {
  const s = new Stitcher();
  s.add([w("prefix", 1), w("not", 6), w("approved", 7)], 0, 8);
  const fresh = [w("approved", 1), w("tail", 3)];
  assert.throws(() => s.add(fresh, 6, 10), /align/);
  s.markUncertain(fresh, 6, 10);
  s.add([w("tail", 1), w("finish", 3)], 8, 12);
  assert.equal(
    s.text(),
    "prefix [uncertain: not | (no words)] approved tail finish",
  );
  assert.equal(s.uncertainties, 1);
});
test("uncertainty alternatives remain inside the final transcript bound", () => {
  const s = new Stitcher();
  s.add([w("x".repeat(159980), 0), w("old", 7)], 0, 8);
  const before = s.text();
  assert.throws(() => s.markUncertain([w("new", 1)], 6, 10), /safety limit/);
  assert.equal(s.text(), before);
  assert.equal(s.uncertainties, 0);
});
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
test("exact old-only negation repro must be marked, never silently deleted", () => {
  const s = new Stitcher();
  s.add([w("Do", 5), w("not", 5.5), w("send", 7)], 0, 8);
  const fresh = [w("Do", 1), w("send", 3), w("tail", 4)];
  assert.throws(() => s.add(fresh, 4, 10), /competing overlap words/);
  assert.equal(s.text(), "Do not send");
  assert.equal(s.anchors, 0);
  s.markUncertain(fresh, 4, 10);
  assert.equal(s.text(), "Do [uncertain: not | (no words)] send tail");
});
test("old repeated lexical words each need a distinct fresh match", () => {
  const s = new Stitcher();
  s.add([w("Do", 5), w("not", 5.5), w("not", 5.8), w("send", 7)], 0, 8);
  assert.throws(
    () => s.add([w("Do", 1), w("not", 1.5), w("send", 3)], 4, 10),
    /competing overlap words/,
  );
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
  test(`a corrected word before later common tokens requires marked alternatives (${common.map((x) => x.text).join(" ")})`, () => {
    const s = new Stitcher();
    s.add([w("alpha", 5), w("wrong", 5.5), ...common], 0, 8);
    const fresh = [
      w("alpha", 5),
      w("corrected", 5.5),
      ...common,
      w("tail", 8),
    ].map((word) => ({ ...word, start: word.start - 4, end: word.end - 4 }));
    assert.throws(() => s.add(fresh, 4, 10), /competing overlap words/);
    s.markUncertain(fresh, 4, 10);
    assert.match(s.text(), /wrong/);
    assert.match(s.text(), /corrected/);
    assert.ok(s.text().endsWith(common.map((x) => x.text).join(" ") + " tail"));
    assert.equal(s.anchors, 0);
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
  s.add([w("Hello", 1), w("international", 6.8), w("cooperation", 7.6)], 0, 8);
  s.add(
    [w("international", 0.8), w("cooperation.", 1.6), w("Finish.", 5)],
    6,
    14,
  );
  assert.equal(s.text(), "Hello international cooperation. Finish.");
  assert.equal(s.anchors, 1);
});
test("leading semantic substitution is ambiguous despite two exact timed words", () => {
  for (const [old, fresh] of [
    ["Do", "Don't"],
    ["Wir", "Wie"],
  ]) {
    const s = new Stitcher();
    s.add([w(old, 6), w("agree", 6.3), w("now", 6.7)], 0, 8);
    const next = [w(fresh, 0), w("agree", 0.3), w("now", 0.7), w("tail", 3)];
    assert.throws(() => s.add(next, 6, 10), /competing first words/);
    s.markUncertain(next, 6, 10);
    assert.equal(s.text(), `[uncertain: ${old} | ${fresh}] agree now tail`);
  }
});
test("exact German trace boundary marks leading Wir/Wie despite timed corroboration", () => {
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
  const next = [
    w("Wie", 0, 0.2),
    w("erklärten", 0.2, 0.68),
    w("ihr,", 0.68, 0.92),
    w("weiter", 1.16, 1.36),
  ];
  assert.throws(() => s.add(next, 156.28, 162.1), /competing first words/);
  s.markUncertain(next, 156.28, 162.1);
  assert.match(
    s.text(),
    /\[uncertain: Wir \| Wie\] erklärten ihr, \[uncertain: \(no words\) \| weiter\]/,
  );
});
test("saved synthetic trace marks for/four and letter/label alternatives", () => {
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
  const next = fresh.map(([text, start, end]) =>
    w(text, start - 43.16, end - 43.16),
  );
  assert.throws(() => s.add(next, 43.16, 48.18), /competing overlap words/);
  s.markUncertain(next, 43.16, 48.18);
  assert.match(
    s.text(),
    /the largest \[uncertain: for \| four\] folded instructions/,
  );
  assert.match(s.text(), /letter\./);
  assert.match(s.text(), /label\.$/);
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
test("a conflicting old phrase is marked rather than assumed hallucinated", () => {
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
  const fresh = next.map((text, i) => w(text, i * 0.05, i * 0.05 + 0.04));
  assert.throws(() => s.add(fresh, 6, 10), /competing overlap words/);
  s.markUncertain(fresh, 6, 10);
  assert.equal(
    s.text(),
    "These are [uncertain: the final] words [uncertain: on the | of the] recording. The [uncertain: final task was to save the draft report. | orange umbrella.]",
  );
});

test("a suffix spelling extension cannot silently change can to cannot", () => {
  const s = new Stitcher();
  s.add([w("We", 5), w("can", 6)], 0, 8);
  const fresh = [w("We", 1), w("cannot", 2), w("send", 5)];
  assert.throws(() => s.add(fresh, 4, 10), /competing overlap words/);
  s.markUncertain(fresh, 4, 10);
  assert.equal(s.text(), "We [uncertain: can | cannot] send");
});

test("reviewed marker preserves retry punctuation while sharing exact common text", () => {
  const earlier =
    "beten die Etmas zu leiten und stellten den Monitor weiter von der Wand.";
  const later = "und schmelzen den Monitor weiter von der";
  const s = new Stitcher();
  s.add(
    earlier.split(" ").map((text) => w(text, 5, 7)),
    0,
    8,
  );
  s.markUncertain(
    later.split(" ").map((text) => w(text, 1, 3)),
    4,
    10,
    {
      words: earlier
        .slice(0, -1)
        .split(" ")
        .map((text) => w(text, 1, 3)),
      start: 4,
    },
  );
  assert.equal(
    s.text(),
    "[uncertain: beten die Etmas zu leiten | (no words)] und [uncertain: stellten | schmelzen] den Monitor weiter von der [uncertain: Wand. | (no words) | Wand]",
  );
  assert.equal(s.uncertainties, 3);
  assert.equal(s.uncertainJoins, 1);
  assert.ok(s.text().length < 223);
});
function reconstructs(rendered, reading) {
  const parts = [];
  let end = 0;
  const words = (s) => (s.trim() ? s.trim().split(/\s+/u) : []);
  for (const match of rendered.matchAll(/\[uncertain: ([^\]]*)\]/g)) {
    parts.push([words(rendered.slice(end, match.index))]);
    parts.push(
      match[1].split(" | ").map((s) => (s === "(no words)" ? [] : words(s))),
    );
    end = match.index + match[0].length;
  }
  parts.push([words(rendered.slice(end))]);
  let positions = new Set([0]);
  for (const choices of parts) {
    const next = new Set();
    for (const offset of positions)
      for (const choice of choices)
        if (choice.every((word, i) => reading[offset + i] === word))
          next.add(offset + choice.length);
    positions = next;
  }
  return positions.has(reading.length);
}
test("word diff reconstruction preserves every reading including negation and repetitions", () => {
  const cases = [
    ["Do not send", "Do send", "Do not send"],
    ["We may not send today", "We may send today", "We may never send today"],
    ["very very clear", "very clear", "very very clear"],
    ["Do send", "Do not send", "Do send"],
    ["soll auf Ihrem", "wollen auf deinem", "soll auf deinem"],
  ];
  let seed = 7419;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (let i = 0; i < 100; i++)
    cases.push(
      Array.from({ length: 3 }, () =>
        Array.from(
          { length: random() % 9 },
          () => ["not", "send", "now"][random() % 3],
        ).join(" "),
      ),
    );
  for (const example of cases) {
    const readings = example.map((s) => (s ? s.split(" ") : []));
    const result = renderUncertainty(readings);
    for (const reading of readings)
      assert.ok(
        reconstructs(result.text, reading),
        JSON.stringify({ example, result }),
      );
    assert.equal(
      result.markers,
      [...result.text.matchAll(/\[uncertain:/g)].length,
    );
  }
});
test("exact rapid German conflict shares all agreed interior words once", () => {
  const result = renderUncertainty(
    [
      "Die Aufnahmen soll auf Ihrem Computer bleiben. Ich lehne jeden Mats von -",
      "Die Aufnahmen wollen auf deinem Computer bleiben. Ich lehne jeden Mats",
      "Die Aufnahmen soll auf deinem Computer bleiben. Ich lehne jeden Mats vor",
    ].map((s) => s.split(" ")),
  );
  assert.equal(
    result.text,
    "Die Aufnahmen [uncertain: soll | wollen] auf [uncertain: Ihrem | deinem] Computer bleiben. Ich lehne jeden Mats [uncertain: von - | (no words) | vor]",
  );
  assert.equal(result.markers, 3);
});
test("exact rapid English conflict never repeats the shared sentence prefix", () => {
  const prefix =
    "The recording should stay on this computer. I will renew every sentence";
  const result = renderUncertainty(
    [prefix + " with...", prefix, prefix + " before"].map((s) => s.split(" ")),
  );
  assert.equal(
    result.text,
    prefix + " [uncertain: with... | (no words) | before]",
  );
  assert.equal(result.markers, 1);
});
test("anchor size boundary and whole-reading fallback preserve all readings", () => {
  assert.throws(() => renderUncertainty([[], [], [], []]), /one to three/);
  for (const size of [512, 513]) {
    const old = Array.from({ length: size }, (_, i) => `word${i}`);
    const fresh = old.slice();
    fresh[250] = "not";
    const retry = old.slice();
    retry[260] = "never";
    const result = renderUncertainty([old, fresh, retry]);
    for (const words of [old, fresh, retry])
      assert.ok(reconstructs(result.text, words));
    assert.equal(result.markers, size === 512 ? 2 : 1);
  }
});
test("deduplication never hides uncertainty when timing alone disagrees", () => {
  const s = new Stitcher();
  s.add([w("same words", 5, 7)], 0, 8);
  s.markUncertain([w("same words", 1, 3)], 4, 10);
  assert.equal(s.text(), "[uncertain: same words]");
  assert.equal(s.uncertainties, 1);
});

test("surface dedup preserves Stop punctuation and case alternatives", () => {
  const result = renderUncertainty([["Stop."], ["Stop?"], ["stop."]]);
  assert.equal(result.text, "[uncertain: Stop. | Stop? | stop.]");
  const nfc = renderUncertainty([["grün"], ["gru\u0308n"], ["Grün"]]);
  assert.equal(nfc.text, "[uncertain: grün | Grün]");
  const apostrophe = renderUncertainty([
    ["Do", "agree", "now."],
    ["Don't", "agree", "now!"],
  ]);
  assert.equal(
    apostrophe.text,
    "[uncertain: Do | Don't] agree [uncertain: now. | now!]",
  );
});
test("crossing contradiction is an alternative, never definite tail or reinserted after seal", () => {
  const s = new Stitcher();
  s.add([w("cannot", 7.6, 7.9)], 0, 8);
  const fresh = [w("can", 1.6, 2.2), w("tail", 2.3, 2.6)];
  assert.throws(() => s.add(fresh, 6, 10), /align/);
  s.markUncertain(fresh, 6, 10);
  assert.equal(s.text(), "[uncertain: cannot | can] tail");
  s.add([w("can", 0, 0.2), w("tail", 0.3, 0.6), w("finish", 1, 1.3)], 8, 12);
  assert.equal(s.text(), "[uncertain: cannot | can] tail finish");
});
test("connected crossing group seals once while a separate following tail survives", () => {
  const s = new Stitcher();
  s.add([w("cannot", 7.6, 7.9)], 0, 8);
  s.markUncertain(
    [w("can", 1.6, 2.2), w("link", 2.1, 2.4), w("tail", 2.5, 2.8)],
    6,
    10,
    { start: 6, words: [w("cannot", 1.6, 2.3)] },
  );
  assert.equal(s.text(), "[uncertain: cannot | can link] tail");
  s.add(
    [
      w("can", 0, 0.2),
      w("link", 0.1, 0.4),
      w("tail", 0.5, 0.8),
      w("finish", 1, 1.3),
    ],
    8,
    12,
  );
  assert.equal(s.text(), "[uncertain: cannot | can link] tail finish");
});
test("repeated or reordered common words stay marked instead of ambiguous anchoring", () => {
  const repeated = renderUncertainty([
    ["same", "same", "old"],
    ["same", "same", "new"],
  ]);
  assert.equal(repeated.text, "[uncertain: same same old | same same new]");
  const reordered = renderUncertainty([
    ["alpha", "beta", "old"],
    ["beta", "alpha", "new"],
  ]);
  assert.equal(reordered.text, "[uncertain: alpha beta old | beta alpha new]");
});
test("unique common text requires compatible timing across all original readings", () => {
  const input = [
    ["shared", "old"],
    ["shared", "new"],
    ["shared", "old"],
  ];
  const aligned = [
    [w("", 1), w("", 2)],
    [w("", 1.1), w("", 2.1)],
    [w("", 1.2), w("", 2.2)],
  ];
  assert.equal(
    renderUncertainty(input, aligned).text,
    "shared [uncertain: old | new]",
  );
  aligned[2][0] = w("", 5);
  assert.equal(
    renderUncertainty(input, aligned).text,
    "[uncertain: shared old | shared new]",
  );
  assert.throws(() => renderUncertainty(input, [[]]), /timing/);
});

test("multi-piece Word surfaces stay atomic with exact internal whitespace", () => {
  const s = new Stitcher();
  s.add([w("Do  not send", 5, 7)], 0, 8);
  s.markUncertain([w("Do send", 1, 3)], 4, 10);
  assert.equal(s.text(), "[uncertain: Do  not send | Do send]");
  assert.equal(s.uncertainties, 1);
  const segmented = new Stitcher();
  segmented.add([w("shared phrase", 5, 7)], 0, 8);
  segmented.markUncertain([w("shared", 1, 2), w("phrase", 2, 3)], 4, 10);
  assert.equal(segmented.text(), "[uncertain: shared phrase | shared phrase]");
});

test("atomic marker surfaces preserve case and literal brackets", () => {
  const s = new Stitcher();
  s.add([w("Morgen [A]", 5, 7)], 0, 8);
  s.markUncertain([w("morgen [A]", 1, 3)], 4, 10);
  assert.equal(s.text(), "[uncertain: Morgen [A] | morgen [A]]");
});
