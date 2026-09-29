# Long-duration implementation evidence

Independent architect notes; do not replace incoming researcher files.

## Exact adversarial marker fixtures

Added Sol's exact absolute-time review cases as deterministic API tests: old-only
negation with a duplicate retry, repeated `very`, case/punctuation disagreements,
one `cannot` Word versus separate `can`/`not` Words, crossing `can` with definite
`send` tail, and the identical German interior run with terminal `Wand.`/omission/
`Wand` alternatives. Each asserts the exact rendered string and reconstruction
of every named source reading from common text and choices. For the crossing
case, the earlier reading is reconstructed with the newly accepted definite tail;
a subsequent window proves the sealed contradiction does not duplicate or drop it.
Earlier/later/retry label the test readings; the existing compact UI choice format
is retained without repeating these labels in every marker.

Character-cap tests accept exactly160000 characters and reject one more before
mutation. Word-cap rejection also preserves text and both uncertainty counters.
All86 Node/18 Python tests pass. This is test-only coverage of production commit
`3eabf11`, with no semantic relaxation and no new GPU measurements. Its existing
rapid/five-minute scores and rejected quality acceptance remain unchanged.

## Atomic ASR word rendering follow-up

The review against the historical 37.64% five-minute result correctly identifies
one remaining representational risk: splitting a single timed `Word` into several
rendering tokens can present a subset as agreed. The renderer now passes each
original Word surface and absolute interval intact, applying NFC only for surface
comparison/display. It preserves internal whitespace, punctuation, case and literal
brackets. Distinct segmentations remain marked, even if joining their surfaces
produces the same visible phrase. This is deliberately conservative.

Connected crossing closure, midpoint compatibility, unique monotonic anchors and
transactional output bounds remain unchanged. We retain compact unlabeled choices:
adding earlier/later/retry to every pocket increases editorial overhead without
establishing which reading is correct. We do not add an optimization DP: rejecting
both reordered anchors is simpler and conservative. Tests cover atomic multi-piece
words, literal surfaces, negation, crossing words and following tail. All 79 Node
and 18 Python tests pass. Plan: clean rapid screen; prior five-minute results remain
historical and do not qualify this representation change.

Completed clean `3eabf11`: rapid 5/5 finals, two joins/four spans/123 marker
characters, WER26/142 and CER98/899. Paced five-minute recording completes all
300 seconds/34 windows with exact audio hashes and no Send: provider final2238ms,
stock insertion5010ms. Eight joins/25 spans/947 characters, WER131/611 and
CER626/3819, five repeated-phrase inserted words, final20 errors14/final5 exact.
All six drafts match `5b3c399` after whitespace normalization; scores are unchanged,
not improved ASR. No retry resolves (rapid0/2, five0/8); five-minute retries cost
9209ms versus30964ms normal decode. Keep the atomic-surface safeguard, reject
quality/usability acceptance. Seven stock checks, formatting, fixture/package
checks and extracted-package native loader pass. No live deployment performed.

## Crossing-word sealing and exact-surface anchors

The old `end <= seamEnd` alternative partition wrongly made a fresh word crossing
the old boundary definite tail. For old `cannot@7.6–7.9` (window end8) and fresh
`can@7.6–8.2`, this manufactured a definite `can` after the marker. The new partition
uses start time and extends the sealed boundary to the end of the connected
old/fresh/retry overlap. Any word starting before the resulting boundary remains
in an alternative; a following disjoint tail stays active. The seal suppresses
already committed crossing words in the next window. Exact and connected-overlap
regressions assert alternatives, following tail, no duplicate/drop, and provider
one-final behavior through bounded retry.

Renderer deduplication is now exact NFC surface, not punctuation/case-stripped
lexical comparison. `Stop.` and `Stop?` remain separate; canonically equivalent
Unicode strings can share a spelling. Hoisted anchors must occur exactly once in
each original reading, occur in the same order, and have midpoint range <=0.8s
across all original timed readings (including a surface-duplicate retry). Both
participants in a reordered anchor pair are rejected, not arbitrarily selected
by LCS. Repeated or incompatible common text stays visibly uncertain even when
its spelling matches. Multi-piece ASR word objects retain their original broad
timing; the renderer does not invent narrower spans. Standalone text-only tests
can omit timings; the production caller always supplies them.

Work is bounded to at most three readings of 512 tokens and 512² pairwise order
checks; larger readings remain whole marked alternatives. No DP table or unbounded
alignment is used. This supersedes prior first-spelling/LCS presentation policy;
older measurements remain historical. Plan: 77 Node/18 Python tests, unchanged
stock no-send checks, clean rapid screening, then decide whether a paced rerun is
justified. Keep existing worker coverage/negation safeguards and loss disclosures.

Completed clean `5b3c399`: 77 Node/18 Python tests and seven stock composer/relay
checks pass. Rapid 5/5, two joins/four spans/114 characters, visible WER/CER
18.31%/10.90%, zero repeated-phrase insertions supported proceeding to paced
validation. The five-minute run completes all 300 seconds/34 windows with exact
audio hashes, eight joins/25 spans/877 characters, provider final 1611 ms and stock
insertion 5012 ms, no Send. Visible WER/CER 21.44%/16.39%; final-20 errors 14,
final five exact. No real GPU retry resolves (rapid 0/2, five-minute 0/8); latter
costs 8911 ms extra decode work. [Results](LONG-DURATION-RESULTS.md) retain the
limits: correctness regression fixes are not ASR quality or usability acceptance.


## Localized word-choice markers

Prefix/suffix-only factoring left agreed interior words repeated. The new
`renderUncertainty` factors a common ordered subsequence across two or three
readings, emits agreed words once, and puts only intervening disputes in
`[uncertain: option | option]` spans. Duplicate local choices disappear; missing
text stays `(no words)`. Decoder labels are removed from this editable user text.
All original readings remain reconstructible in order; repeated words get distinct
positions. Reconstruction is lexical: case/punctuation use the first spelling,
not byte-exact preservation of each punctuation variant. An explicit regression
keeps `Please, do [uncertain: not | (no words)] send.` while deduplicating case and
terminal-punctuation variants; `Do` versus `Don't` remains a disputed lexical choice.
Multiple local choices are not a claim that every combination was
observed by ASR, and none is selected as the correct reading.

Alignment is deterministic progressive LCS, bounded to three readings/512 tokens
per reading and at most two 513×513 Uint16 tables (~1 MiB total allocation). Larger
inputs use linear prefix/suffix factoring with complete alternatives. This does
not change acoustic decoding, seam acceptance or the bounded retry. Metrics now
separate uncertain joins from visible marker spans. Tests include exact rapid
German/English examples, old-only negation, 100 seeded repeated-word/negation
reconstruction cases, and the 512/513-token boundary and oversized reading count.

Plan: deterministic tests and stock no-send checks, then commit clean and run the
20-second screen. Only proceed to paced five-minute measurement if rapid cases
complete and the exact examples show less repeated agreed text while preserving
all conflict choices. Record visible score, characters, joins/spans, retries and
tail errors; no presentation score improvement establishes ASR quality.

Completed clean `ab6422c`: 71 Node / 18 Python and seven stock composer/relay
checks pass. Rapid gate completed first: 5/5, two joins/four localized spans,
132 marker characters, zero repeated-phrase insertions, visible WER/CER 23.94% /
14.57%. Only then ran paced five-minute: all 300 seconds/34 windows and audio hashes
match; eight joins/23 spans/813 marker characters, retry work 8439 ms, provider
final 1452 ms, stock insertion 5006 ms, no Send. Visible WER/CER 24.06% / 17.60%,
nine repeated-phrase insertions; final-20 errors 12, final five exact. Every fresh text
matches a deterministic re-rendering of the old readings. Keep editorial format;
no ASR gain, verified tail or general usability acceptance. See [results](LONG-DURATION-RESULTS.md).


## Compact uncertainty presentation

`Stitcher.markUncertain` now deduplicates readings using the same normalized
word comparison as seam matching (case/punctuation ignored, ordered word counts
preserved), keeps the first spelling, and factors only an equal initial/final
word sequence shared by every distinct reading. This is deterministic factoring,
not interior re-alignment or selection of an ASR winner. Shared words sit outside
the marker and remain sealed with it. A missing middle is explicitly `(no words)`;
for example `Do [uncertain: earlier: not | later: (no words)] send`. One unique
reading still stays marked because timing may be the ambiguity. Tests reconstruct
each distinct reading from prefix + alternative + suffix, including repeated
words and third readings, so compaction cannot erase the conflicting negation.

The exact reviewed 223-character marker becomes 143 characters by dropping its
lexically duplicate retry; its differing beginnings/endings do not permit further
prefix/suffix factoring. No generic “few words” truncation hides a larger conflict.
This changes presentation only: the old-only-word, leading-substitution and
worker text/word-coverage safeguards and bounded retry/Stop behavior remain.

Plan: deterministic and stock no-send checks, then clean rapid and paced
five-minute GPU reruns. Score the actual compact visible text with the unchanged
lexical metric, adding marker-character counts. Compare edit burden to verbose
`a6911b9`, not an ASR quality gain against older less-safe splice policies.

Clean `e0157ce` completed 68 Node / 18 Python and seven stock composer/relay
checks. Rapid 5/5 keeps two markers but reduces their characters 527→280; visible
WER/CER 35.21% / 25.81%. Paced five-minute completes 300 seconds/34 normal windows
with eight markers (2050→1888 characters), 8120 ms retry work, provider final
1651 ms, stock insertion 5009 ms, no Send. Visible WER/CER 37.64% / 34.30%; final-20
errors three, final five exact. Reformatting saved verbose drafts reproduces every
fresh text exactly. Keep compact presentation; reject usability acceptance and
ASR quality-gain claims. [Measured results](LONG-DURATION-RESULTS.md) include the
presentation replay recipe and append-only evidence IDs.


## Old-only overlap after a valid anchor

The first-fresh-anchor splice formerly discarded the entire old suffix. Exact
`Do@5 not@5.5 send@7` versus fresh `Do@5 send@7 tail@8` therefore lost `not`
even though the anchor itself agreed. The new guard requires every lexical old
word after the anchor to survive monotonically in the fresh hypothesis, with the
existing 0.8-second midpoint tolerance and a distinct match for each occurrence.
Missing or substituted old words raise alignment ambiguity into the one-retry,
then-visible-alternatives path. New-only fresh additions remain intact. Case and
punctuation differences continue to compare equal. No list of “important” words
is used: any content word can change intent, including numbers and names.

This intentionally supersedes tests that assumed discarded text was hallucinated
or a changed word was corrected. Even spelling extensions can change meaning
(`can`/`cannot`). Ordinary corrections may now need markers; that is measured
review burden rather than evidence of ASR truth. Sealed earlier alternatives
cannot be rewritten by later windows. Leading substitutions and Python/Node text
coverage safeguards from `565b9d1` remain active.

Plan: exact omission and repeated-word regressions, provider retry/final test,
full deterministic suite and unchanged stock no-send checks; commit clean, rerun
all rapid fixtures and the paced five-minute whole stock-code path. Report marker
and retry counts, verbatim WER/CER/duplication, GPU cost, queue occupancy and final
tail/deadline. Do not inherit qualification from the previous splice semantics.

Completed clean `a6911b9`: 65 Node / 18 Python tests and all seven stock composer/
relay checks pass. Rapid 5/5 now has two markers, marked WER/CER 53.52% / 43.38%.
The paced five-minute run completes all 34 normal windows and byte integrity,
with eight retries/eight markers costing 6642 ms extra decode work. Provider final
1317 ms, stock insertion 5008 ms, no Send. Marked WER/CER 42.06% / 38.02%, 137
repeated-phrase inserted words, final-20 errors three, final five exact. Keep the
omission safeguard; reject usability/release acceptance because the review burden
is high. [Full results](LONG-DURATION-RESULTS.md) distinguish completion from quality.


## Text coverage and leading semantic disagreement review

The runtime assembles only timed words. Reviewing `python/worker.py` against
Faster-Whisper 1.2.1's `transcribe.py` (`Segment.words` is explicitly optional)
showed that checking merely a nonempty aggregate array could lose an entire later segment. `collect_segments` now
requires every timestamped segment's lexical content to equal its words; mixed
complete/missing-word segments fail before any successful reply. Node's worker
also independently checks total coverage on timestamped requests (the evaluation
whole-utterance comparator intentionally has no timed words). Both use NFKC,
lowercase, and retained Unicode letters/marks/numbers, ignoring punctuation and
spacing. This checks representation coverage, not ASR truth or token boundaries.
No approximate timestamp fallback invents words/times. Error logs contain no text.

The leading-substitution branch in `src/stitch.ts` previously kept the old first
word even when fresh differed. Two exact following words establish location, not
which reading is right: `Do`/`Don't` can invert meaning. Such a seam now raises
alignment ambiguity into the existing bounded retry/marker path. It cannot
silently choose old `Wir` over fresh `Wie`. Exact timed trace and provider tests
verify both alternatives, one retry, one final and no early publication.

Plan: run deterministic protocol/stitch/provider tests and unchanged stock
no-send tests, commit a clean candidate, then rerun the rapid set and paced
five-minute stock-code replay. Record additional markers/retries, GPU/decode cost,
verbatim WER/CER and repeated-tail/tail completeness. Prior `036514b` completion
is historical evidence, not qualification of these changed semantics.

Completed clean `565b9d1` results: 62 Node / 18 Python tests, three stock relay-path
cases and four composer regressions pass. Rapid 5/5 has unchanged scores and no
markers. The paced five-minute run completes all 34 normal windows and byte
integrity with two markers/two retries (1617 ms total), 528 ms provider final and
5008 ms stock insertion, no Send. Verbatim marked WER/CER 14.40% / 9.58% include
all alternatives; final 20 words are exact. The extra marker increases edit burden.
See [full measured evidence](LONG-DURATION-RESULTS.md); no quality gain is claimed.

## Bounded retry and visible uncertainty experiment

The official [provider callback contract](https://github.com/openclaw/openclaw/blob/d30287734dee7ab3d86b216777c11ea195a021b8/src/realtime-transcription/provider-types.ts)
accepts ordinary text in `onTranscript`. Stock relay forwarding and composer
editable insertion preserve a literal uncertainty span; the real-source smoke
test verifies exact text and absence of chat-send RPCs. No new event, core/UI
patch or automatic send is needed. A marked draft is not a verified final.

On alignment ambiguity only, retain one preceding 16-second audio snapshot and
construct one wider window up to 20 seconds from that context plus current
audio. It uses the existing serial decoder. OOM/protocol/process errors are not
treated as uncertain text. Stop never receives a longer deadline; when remaining
budget is below max(500 ms, 1.5 times the current decode duration), skip retry and
mark directly. The retry can still exceed that estimate and trigger the existing
hard deadline, which remains an explicit failure rather than a claimed recovery.

More context does not prove an old negation was hallucinated. An unmarked retry
must retain both the previous words in its covered span and the fresh word
sequence monotonically with token/time agreement, then pass ordinary stitching.
Otherwise preserve the old stable prefix, seal an inline uncertainty span with
earlier/later/retry readings of the seam, and continue with fresh tail words.
Later windows cannot rewrite the sealed marker. A skipped retry has two readings.
Markers and alternatives count toward existing transcript character/word bounds;
all audio remains bounded in memory (672,000 bytes peak PCMU, excluding protocol
copies, floating-point conversion and model memory). No recovery file is created.

Tests cover retry size/serial order, successful retention, missing negation,
marker persistence, bound overflow, deadline skipping, deadline/disposal races,
stock editable insertion/no-send, and scoring that includes all marker text.
Metrics include retry count/audio durations/decode times, marker count and a
review-required flag. Verbatim WER/CER include labels and all alternatives; no
best-alternative selection is allowed to hide edit burden. Clean `036514b` rapid and five-minute runs now complete: rapid 5/5 without retries
or markers; paced five-minute 34 windows with one 16.94-second retry (865 ms) and
one review-required marker. Provider finalization is 581 ms; stock editable
insertion is 5008 ms with no send. See [measured results](LONG-DURATION-RESULTS.md)
for verbatim scoring and limitations. These do not establish microphone,
Swiss-German or hour-long acceptance.

## Isolated-old ambiguity candidate (`1a3f6fc`)

The exact saved window #13 starts at 108.98. Old `a` occupies 109.32–109.56 and
`chair.` 109.56–109.74; old `We` is 110.04–110.28. Fresh `We` spans
108.98–110.08 and is followed by the same timed `agreed to keep ... task`.
The old words are not isolated before the fresh token; they overlap its broad
estimated span. Treating every old start inside the window as a phantom was too
strict. The new candidate rejects an old-only word before the initial anchor
only when its start is inside the fresh window **and** it ends at least 200 ms
before the fresh first token starts. The exact phantom at 6.0–6.3 versus fresh
anchor at 7.0 still rejects (700-ms separation). Tests cover the inclusive 200-ms
boundary, a permitted 190-ms gap, and the exact full #13 phrase/timestamps.

This is a heuristic uncertainty margin, not calibrated confidence or timestamp
ground truth. Old-only words overlapping/near the first fresh token may remain,
including potentially spurious words. It does not prove absence of hallucinations
or preserve all real words under inaccurate timestamps. Initial-prefix and
corroborated leading-substitution rules remain unchanged. No automatic re-decode
has been added; clearly isolated ambiguity still fails with no final.

All 52 Node and 13 Python tests pass. Offline sequential replay of the saved
34-window hypotheses now passes 23 windows (10 overlap joins, 12 gaps), then
rejects #24 at 207.34. Its fresh first `und` begins at 208.68; old `die` ends
207.94 and `Etmas` ends 208.44, separated by 740 and 240 ms respectively while
fully within the fresh audio. This remains a materially different case from the
broad first-word overlap at #13. The failed offline transcript is not scored as
a complete five-minute output or used for latency claims. Fresh paced tests
record qualification separately.

## Previous initial fresh-prefix candidate (`c0e6b83`)

Only the first fresh word may anchor the splice. Candidates match that token
within 0.8 seconds midpoint tolerance; exact initial runs rank ahead of leading
substitutions, then longer initial runs and closer timing break ties. A leading
one-for-one substitution is allowed only with positive-duration acoustic overlap
of at least half the shorter word and at least two following exact timed words.
The old first word is retained (e.g. `Wir` rather than fresh `Wie`), then the entire
fresh suffix replaces the old suffix. Later matches never discard a fresh prefix.

This explicitly changes the earlier corrected-word policy: `alpha recovered
anchor tail` and a newly recovered negation are retained, including through the
provider final. Post-anchor substitutions use the fresh spelling: the exact saved
for/four case retains fresh `four`, while correcting `letter` to `label`.
That does not establish which recognizer hypothesis is correct. An old-only word
after the initial anchor is part of the superseded suffix, not silently retained.
The symmetric guard still rejects any wholly contained old-only word before the
first fresh anchor, including the exact phantom case. Old words starting before
the new window are clipped context. No bounded re-decode fallback is implemented.

All 50 Node and 13 Python tests pass: recovered insertion/negation retention,
phantom rejection, exact German Wir/Wie timing and insufficient-corroboration
rejection, for/four suffix policy, corrected repeated tail, and real repetitions.
Offline sequential replay of saved hypotheses still rejects at window 13. An
independent pairwise diagnostic initializes each boundary from the immediately
preceding saved window: 27/33 boundaries pass, six reject (#13 at 108.98, #20 at
173.60, #24 at 207.34, #26 at 223.78, #28 at 241.10, #34 at 293.98 seconds).
This is not a complete transcript or paced measurement. We cannot reproduce the
research suggestion's all-34-window success while enforcing this symmetric guard;
the generic repeated-tail regression passes but saved boundary #34 is rejected.
Clean rapid and paced-five-minute runs qualify this candidate separately.

## Previous timed-substitution policy (`a24cce4`)

The symmetric exact-token guard was too strict for time-coincident substitutions.
The saved window at 31.16 seconds contains `for` at 43.72–44.00; the window at
43.16 contains `four` at 43.72–44.02 before the same later anchor. It is a
one-for-one recognition disagreement, not an inserted/missing token. The new
candidate pairs old and fresh prefix words monotonically through the chosen
anchor, allowing no unmatched slots. Each pair must have midpoint difference
at most 0.8 seconds. Different normalized tokens additionally need positive
durations and intersection covering at least half the shorter duration. Same
tokens retain the existing time tolerance. The old spelling is retained through
the anchor; the fresh suffix can correct `letter` to `label`. This is an explicit
choice between disagreeing recognizer hypotheses, not proof the old spelling is
right. The former equal-time corrected-token rejection tests now assert this
specified substitution behavior; insertion/deletion adversaries still reject.

Words starting before the fresh audio window are left-clipped context: that
decode did not receive their whole acoustic span. They may remain before its
first match. This matters for `behind` at 27.00–27.34 with a fresh start of 27.16,
and `and` at 43.00–43.20 with fresh start 43.16. Words starting at/after the new
window, including the exact `phantom@6` case, must all be accounted for through
the anchor. Tests cover clipped context separately from a fully contained phantom.
Timestamp estimates can be wrong, and equal-count insertion/deletion combinations
with coincident timings cannot be proven absent by this heuristic. No semantic
or real-microphone completeness guarantee is claimed.

All 49 Node and 13 Python tests pass, including the exact saved `for/four` timing
and corrected suffix. Offline reassembly of the full saved trace passes the first
12 windows but rejects window 13 at start 108.98: fresh text begins with `We`,
omitting old `a chair` at 109.32–109.74 within the fresh coverage. That remains an
unmatched-old ambiguity. This diagnostic uses old hypotheses, not fresh inference
or paced latency. Current clean paced results are recorded separately.

## Fresh-prefix deletion correction

Independent QA found that a late overlap anchor could discard a real word that
only the fresh hypothesis recovered. Executing the pre-fix implementation from
`0050c30` on old "Do send this" and fresh "Do not send this message" confirms a
successful merged "Do send this message". Matching later words does not justify
deleting the negation. The `94bda99` fix requires the selected contiguous,
time-consistent match to cover every fresh word through the splice anchor.
Otherwise reconciliation throws; the provider clears the session and emits only
an error. Adversarial tests cover an interior recovered negation, an unmatched
leading word, and the provider's no-final behavior. Existing repetition and
hallucinated-tail tests remain passing. This is a conservative failure policy,
not proof that the recognizer heard every spoken word or that failures preserve
the user's dictation. Failing the session loses its text as documented.

The exact additional reviewer repro is now checked: old `alpha@5, anchor@7`;
fresh `alpha@5, recovered@5.5, anchor@7, tail@8`. Tests use 300-ms word spans
and a fresh window beginning at 4 seconds, converting its timestamps to relative
1/1.5/3/4 seconds. Running the pre-fix `0050c30` implementation confirms the
successful but incorrect `alpha anchor tail`. The guarded version throws.
Single-word run ties can still select the later anchor, but the separate prefix
proof rejects it because run length 1 cannot account for three discarded fresh
words. Additional tests reject silent reversion of a corrected word before a
later single common token and a two-token `in the` sequence. All 42 Node and
13 Python tests pass; runtime code did not change for these additional tests.
This resolves the precise silent-deletion repro, not overall seam reliability:
the previously recorded rapid German and five-minute failures still apply.

### Symmetric retained-prefix follow-up

The exact symmetric interior case (old `alpha@5, old-only@5.5, anchor@7`, fresh
`alpha@5, anchor@7, tail@8`) already fails the fresh-prefix guard because its
matching run is broken. A further case exposed a remaining gap: old
`old-only@4.5, alpha@5, anchor@7` versus the same fresh hypothesis succeeded under
`8fa9dcc`, retaining an unconfirmed old word before the first fresh match. This
was independently executed against that revision, not inferred from code alone.

`73aaec5` additionally requires every retained old word whose end is after the
fresh window start, through the chosen anchor, to belong to that same contiguous
token/time matching run. Together the checks form a conservative monotone
one-to-one prefix alignment with no unmatched words on either side. Old words
ending before the fresh audio window are outside that comparison. This does not
choose an earlier tie as a workaround. Three new tests cover the symmetric
interior conflict, old-only leading overlap, and valid earlier context; the exact
fresh-word, corrected-tail and genuine repetition regressions still pass.
All 45 Node and 13 Python tests pass. The stricter policy can reject more sessions;
the new clean paced results must be used for its qualification.

The additional exact symmetric repro is now a regression too: old `phantom@6,
anchor@7`, fresh `anchor@7, tail@8` with window start 6 seconds. The 300-ms
phantom span ends at 6.3, so it is inside fresh time coverage, not exempt earlier
context. `firstOldInWindow = 0` precedes `matchedOldStart = 1`, and the guarded
merge throws without a successful final. All 46 Node and 13 Python tests pass,
including genuine repetition and corrected-tail cases. No production code change
was needed for this additional exact test.

The final paced post-production-change run is `long-symmetric-five` at clean
`73aaec5`: failure after 32.768 seconds accepted, not five-minute acceptance.
After adding the exact phantom regression, every recorded runtime/harness source
hash and the Python worker hash was compared with the current files and matched.
In particular, `src/stitch.ts` is SHA-256
`fff4fb6fc30f83bb2e3d4e1c35ec87ee4890998949a3f1f0fc374d7288ab2dd8`.
Thus that paced rerun exercises the current production seam code, rather than
the older `9d27248` profile. Rapid German/boundary failures remain documented;
the conservative guard is not represented as usable long-dictation reliability.

An offline replay of the saved 34-window five-minute trace first rejects window
5 (43.16–48.18 seconds): a changed token before a later matching sequence no
longer gets silently discarded. This is diagnostic evidence only; paced reruns
and acceptance decisions are recorded separately in the append-only ledger.

## Exact-source TTL and transcript-bound recheck

Rechecked for Kappa on 2026-09-29 against the same prepared source commit.
`transcription-relay.ts:34` sets 30 minutes; creation fixes `expiresAtMs` and
installs a deadline timer. Both append and Stop call `getTranscriptionSession`,
which delegates to `requireActiveTalkRelaySession` in `relay-session-lifecycle.ts`.
The helper's expiry comparison is strictly `now > expiresAtMs`; the independent
timer closes at the deadline. Neither audio nor Stop extends the lifetime.
Expiry closes/removes the relay without retaining it for the ordinary Stop drain,
so a late provider final cannot repair this. A plugin-only hour-long claim is false.

The current worker is window-local: Python emits at most 16,000 text characters
per decode; Node independently bounds each reply to 64 KiB including JSON and
timestamped words. These are independent limits (JSON escaping/metadata can reach
the byte bound first), not a guarantee that every 16,000-character reply fits.
Production windows are at most 16 seconds. TypeScript accumulates the session's
words, up to 160,000 characters / 24,000 words, and sends the final directly through
the provider callback, never through worker stdout. A deterministic provider test
joins 20 window results into exactly 18,019 characters. This verifies aggregation,
not ASR quality, a real long-duration decode, or host/browser message acceptance.

### Ceiling recovery and paced-test audit

`src/realtime-transcription/provider-types.ts:21–40` has transcript/error/speech
callbacks, but no provider-initiated successful capture-stop acknowledgement.
`transcription-relay.ts:315–355` forwards a final without closing capture, whereas
an error removes the relay. `composer-dictation.ts:628–636` preserves an existing
snapshot on an error by stopping with `commit: true`. Final-then-error therefore
offers a possible interrupted-text recovery experiment, but does not establish
an atomic last-accepted-audio boundary during the asynchronous drain. No such
sequence is implemented or claimed safe. Current plugin `fail()` clears every
assembled word and buffered byte; its 60-minute ceiling is explicitly unsuitable
as a loss-safe user limit. Host expiry needs separately scoped changes, including
safe drain semantics, rather than only a longer TTL constant.

The corrected five-minute artifact (`long-five-aligned`, clean `9d27248`) records
row start 14735.944015 ms, ready delay 3464.084849 ms, row end 323209.202594 ms,
and Stop-to-result 5008.717413 ms. Subtracting ready and final time gives
300000.456317 ms of paced audio delivery (about 300.00046 seconds). The full run
was 315615.663096 ms including setup/baseline/teardown. `experiment.mjs` paces by
absolute cumulative PCMU duration at 8000 bytes/s using 4096-byte blocks; each
block precedes its wait, permitting up to 512 ms burst lead. This is real-time
source-level integration with simulated DOM/audio device/RPC transport, actual
stock encoding/controller/relay, and actual local Python/GPU inference. It does
not test a browser engine, listening Gateway, network, or physical microphone.

## Primary-source checks

- Prepared OpenClaw `src/gateway/talk/transcription-relay.ts`, source commit
  d30287734dee7ab3d86b216777c11ea195a021b8: session TTL is fixed at 30 minutes
  (lines 34, 265, 364–370). `sendTalkTranscriptionRelayAudio` does not renew it.
  This is a host-level obstacle to a full 60-minute browser session. No core
  modification is authorized or made; escalate that deviation to Kappa before work.
- Same relay retains the stopped provider for five seconds. Stock
  `ui/src/pages/chat/composer-dictation.ts:659–700` commits nonempty snapshots before
  waiting for final. Keep all chunk text internal and publish exactly one final.
- [Pinned Faster-Whisper 1.2.1 implementation](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/faster_whisper/transcribe.py)
  exposes word start/end/text via `word_timestamps=True`. Those timestamps are
  estimates, not proof of accurate word boundaries. Its default temperature list
  can perform repeated fallback decodes; windowing alone does not bound decode time.
- [Whisper-Streaming paper](https://arxiv.org/abs/2307.14743) describes agreement over
  successive hypotheses and bounded-buffer strategies. Our short overlapping-window
  seam algorithm is a separate implementation, not a reproduction of its quality
  or latency results. It must be measured on our transport and fixtures.

## Initial implementation choices to test

Eight-second inference windows, two-second overlap, one serial decoder. Timed
word/token agreement joins overlapping hypotheses, retaining the previous prefix
and replacing its short tail. No textual common-prefix alone across the entire
recording. Ambiguous overlapping hypotheses fail explicitly instead of guessing a
successful complete result. Bound pending audio to 24 seconds (including overlap),
per-request audio separately, final text separately, and session wall/audio time
at 60 minutes. These are memory/overload controls, not supported-duration claims.
Automatic language detection occurs per window, allowing language changes but
also risking wrong-language choices on short or synthetic speech. Evaluate this.

## Verified follow-up

Read the incoming `long-duration-host-contract.md`, `long-duration-quality.md`,
and `host-ttl-change.md` without modifying them. Their source-level constraints
match the active checkout. `scripts/ttl-smoke.mjs` executes the unmodified relay
with a fake clock: audio is accepted just before 30 minutes; expiry closes the
provider, labels the relay completed, rejects later appends, and ignores a late
final. This verifies the host obstacle without a live Gateway or core patch.

The 8/2 candidate failed a synthetic German seam after the first window returned
English text. A 12-second diagnostic window also returned English. A 16-second window
recognized German in that case, motivating the measured 16/4 candidate. No claim
is made that longer context always solves language selection. Pause-aware endpoint
selection subsequently reduced omissions on the mixed development fixture; it
uses 20 ms decoded-PCMU RMS, threshold 0.005, 600 ms quiet after activity, and a
four-second minimum. It does not filter or discard audio. Pause overlaps are
500 ms; forced 16-second boundaries retain four seconds. This is a separately
measured heuristic, not Silero VAD or a reproduction of Whisper-Streaming.

Host cancellation and normal Stop both call provider `close()` with no reason.
The plugin cannot distinguish them; it drains briefly under its existing deadline.
The removed relay/browser accumulator suppresses cancelled-session insertion.
Plugin disposal/reload is distinct and immediately fails the owner and stops its
worker. These boundaries are tested without production state.

## Microphone-path limits and test scope

The stock composer requests `AudioContext({sampleRate: 8000})` and refuses a
context whose actual sample rate differs (`composer-dictation.ts:150–159`). Its
input pump requests 4096-sample blocks (`talk/audio.ts:75–96`); the paced composer
harness now uses that block size, while provider-only rapid screens use 800-byte
frames. The in-process harness decodes synthetic PCMU to floats and executes stock
encoding; exact fixture/provider hashes prove this round trip for these samples.
It does not measure the browser/device resampler, acoustic echo cancellation,
noise suppression, gain control, clipping, room noise, or permission/device changes.

The 8 kHz signal cannot carry original frequencies above 4 kHz. Conversion to the
model's 16 kHz input does not reconstruct those missing frequencies. The independent
mu-law codeword and tone tests validate conversion, not microphone quality. The
new fixtures were synthesized at 22050 Hz and resampled to 8 kHz before companding;
this is a controlled transport input, not a recording of OG's laptop. Standard
German synthetic substitutions and code-switch errors require separate real-mic
and Swiss-German evaluation; neither passing callbacks nor a lower synthetic WER
resolves those questions.

## Alignment correction after the first five-minute replay

Offline traces showed a model-generated repeated suffix in one window followed
by a corrected hypothesis in the next. The original latest-token rule anchored
on a later common article and retained six unwanted words. Contiguous token-run
agreement, with the same timestamp tolerance, removes that failure in a fixed
regression and recorded-hypothesis reassembly. Time tolerance and tie-breaking
remain heuristics; this is not proof against every repeated-name/boundary case.
The missing German sentence was absent from the window hypothesis before assembly,
so fixing alignment cannot recover it. No decoder setting was changed to conceal
that failure. The second paced five-minute run tests the actual corrected pipeline.
