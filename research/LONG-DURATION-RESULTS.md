# Long dictation: preliminary measured results

Status: experimental implementation ready for review; not release or microphone acceptance.
All speech here is self-authored, non-looped eSpeak NG synthesis transported as
8 kHz G.711 mu-law. The five-minute script has 218.332 seconds of synthesized
paragraph audio and padding to 300 seconds. Public manifests record every hash.
No private OG recordings, real microphone, or Swiss-German acceptance is claimed.

## Latest evidence: coverage and semantic first-word safeguards (`565b9d1`)

Clean `565b9d1e1207c1505c4901308400969a3012b608` fails closed if any timed
segment's text lacks word coverage, with an independent Node total-coverage check.
Leading substitutions now enter retry/marking even when two subsequent timed
words agree. Old `Do` versus fresh `Don't`, and the recorded `Wir`/`Wie`, no
longer silently choose the old first word. Fixed-fixture reruns use the same
medium/float16/beam5, repo-local environment and RTX 3060 Laptop 6 GB as before.

- **Rapid 5/5:** no retries or markers; WER 15/142 (10.56%), CER 32/899 (3.56%).
  Same errors as `036514b`: German eight substitutions/one insertion, English
  one substitution, mixed five substitutions with inexact final five. Boundary
  and silence remain error-free. No scored deletions or repeated-phrase insertions.
- **Paced five-minute completion:** 299999.823 ms audio delivery; 300 seconds /
  2,400,000 bytes, fixture/input/relay hashes identical. 34 normal windows,
  14 anchors, 17 gaps, **two review-required markers** and two retries. Retry audio
  17.82 s / 16.94 s; decode wall time 833.057 ms / 784.418 ms (**1617.474 ms total**).
  Neither retry extends the final deadline. Both original competing readings are
  preserved instead of silently resolving the changed first word.
- **Stop:** provider final **528 ms**, stock editable insertion **5008 ms**;
  only Talk RPCs, no automatic Send. Queue peak **17.028 s**, maximum unprocessed
  coverage **16.896 s**, including lookahead rather than only GPU waiting time.
- **GPU:** baseline **551 MiB**, peak **2797 MiB**, post-disposal **551 MiB**;
  sampled mean host utilization **7.84%**. These are host-wide samples, not isolated
  kernel measurements. One run does not show improved GPU efficiency.
- **Verbatim marked scoring:** WER **88/611 (14.40%)**, CER **366/3819 (9.58%)**;
  38 substitutions, two deletions, 48 insertions, one adjacent duplicate and
  26 repeated-phrase inserted words. Marker labels and all alternatives count;
  no best-reading selection or marker stripping. Final 20 words have zero edits,
  final five exact. The higher edit burden than `036514b`'s one-marker output is
  **not a quality improvement**; marked draft text is not verified transcription.

**Keep** both P1 safeguards and bounded marked-draft completion. **Reject** quality
improvement, general reliability, real-mic/Swiss-German or hour-long acceptance.
No valid measured fixture failed representation coverage, but an incomplete
future decoder response will fail explicitly rather than insert a truncated
success. Stock expiry at 30 minutes and other hardware/deadline/cap loss risks
remain. This is actual stock code with simulated DOM/capture/RPC and a real GPU
worker, not a real browser/Gateway/mic test. The 300-second fixture includes
218.332 seconds synthesized speech plus pauses/padding. Ledger entries:
`long-coverage-rapid`, `long-coverage-five`.

## Previous evidence: bounded retry and marked draft (`036514b`)

Clean `036514beb5a86e26ef3b1d102c36f039e528b028`, medium/float16/beam5 on
RTX 3060 Laptop 6 GB, completes the rapid and paced five-minute reruns. Decisions
and source/fixture/artifact hashes are appended as `long-uncertainty-rapid` and
`long-uncertainty-five` in [the ledger](experiments.jsonl).

- Rapid: **5/5 finals**, zero retries/markers, WER 15/142 (10.56%), CER 32/899
  (3.56%), unchanged from the previous candidate. German has eight substitutions
  and one insertion; English one substitution; mixed five substitutions and an
  inexact final five; boundary and silence pass without errors. This is not
  general German/mixed-language quality acceptance.
- Five-minute: **all 300 seconds / 2,400,000 PCMU bytes** delivered through stock
  encoding/controller/relay, with identical fixture/input/relay hashes. **34 normal
  windows**, 15 anchor joins and 17 gaps. One **16.94-second retry costs 865 ms**
  decode wall time and leaves **one visible uncertainty marker**. Later windows
  continue and the complete draft reaches the editable composer with no send.
- Provider finalization **581 ms**, within the 4500 ms deadline; stock composer
  insertion **5008 ms**. Queue peak **17.480 s**; maximum unprocessed coverage
  **17.408 s** includes lookahead, not solely time waiting for the GPU.
- GPU memory baseline **551 MiB**, peak **2888 MiB**, post-disposal **551 MiB**;
  mean sampled host GPU utilization **7.28%**. Retry duration is extra decode wall
  time, not isolated kernel time; host-wide telemetry and one run do not establish
  an efficiency improvement.
- **Review required:** verbatim marked WER **65/611 (10.64%)**, CER **246/3819
  (6.44%)**; 29 substitutions, eight deletions, 28 insertions. Scores include
  marker labels and every competing reading, with no best-alternative selection.
  One adjacent duplicate and 13 repeated-phrase inserted words are counted across
  this verbatim text. Final 20 words have zero edits; final five are exact.
  These scores measure the marked draft's edit burden and cannot be presented as
  an ASR quality improvement over older unmarked results.

**Keep** bounded recovery and marked editable-draft completion. **Reject** verified
transcript quality, general reliability, real-microphone, Swiss-German or hour-long
acceptance. This is paced stock-source integration with simulated DOM, capture and
RPC plus the real local GPU worker, not a real browser/network/Gateway/mic session.
The fixture has 218.332 seconds of synthesized speech padded to 300 seconds.
Worker/OOM/queue/deadline/cap failures still abort; markers recover alignment
ambiguity only. Stock host expiry at 30 minutes still risks losing final-only text.

Offline saved-hypothesis replay (`long-uncertainty-saved-trace`) also completes all
34 windows with one marker and no retry. It checks assembly/persistence only and
is not fresh inference, quality or paced evidence.

## Previous qualification: isolated-old ambiguity (`1a3f6fc`)

**Five-minute acceptance remains rejected.** Clean
`1a3f6fc272e5bf740772941aa9b71762e61821ad` replaces the blanket old-prefix guard
with a 200-ms isolation margin before the first fresh token. Exact #13 broad
`We` timing now preserves `a chair`; the isolated phantom still rejects. Nearby
or overlapping old-only words may remain, which can retain spurious words; this
is an uncalibrated timing heuristic, not a completeness or hallucination guarantee.

- Rapid: **5/5 finals**, unchanged **15/142 word edits (10.56% WER)** and
  **32/899 character edits (3.56% CER)** versus `c0e6b83`. German has eight
  substitutions and one insertion; English one substitution; mixed five
  substitutions and an inexact final-five suffix. Boundary and silence have
  zero edits. No scored deletions or repeated-phrase insertions. Finals in
  fixture order German/boundary/mixed/silence/English: 736/594/486/4/634 ms.
- Paced five-minute stock-code/real-GPU integration: **0/1 finals**. Window #13
  passes, but the 24th attempted window fails after **212.480 seconds accepted**,
  with 23 successful merges (10 overlap joins, 12 gaps). Remaining fixture audio
  is not delivered. No final WER/CER, tail score or final latency exists. Queue
  peak 17.096 seconds; unprocessed coverage 16.896 seconds including lookahead.
  GPU memory 551 MiB baseline, 3516 MiB peak, 551 MiB after disposal. This is a
  failed five-minute test, not supported 212-second dictation or a complete run.

Saved-hypothesis replay independently reaches the same failing window. Unlike
#13, #24 has old words wholly inside fresh audio and ending 740/240 ms before
the first fresh token. The symmetric isolated-word guard deliberately rejects
that ambiguity. No wider context re-decode or recovery is implemented. Keep the
specific broad-timestamp fix for review, reject release/long-duration acceptance.
All historical runs remain separately attributed in the append-only ledger.

## Previous qualification: initial fresh prefix (`c0e6b83`)

**Reject long-dictation/quality acceptance.** Clean
`c0e6b8393758888458cdd1789ca30f2239f7d236` anchors only the initial fresh prefix,
retains all following fresh words, and still rejects a wholly contained old-only
word before that anchor. A leading substitution requires two subsequent exact
timed words. Exact recovered-word/negation retention, phantom rejection, German
Wir/Wie, for/four, corrected-tail and genuine repetition tests pass. The new
for/four policy retains fresh `four`; it does not claim that spelling is correct.

- Rapid: **5/5 finals**, WER **15/142 = 10.56%**, CER **32/899 = 3.56%**.
  Versus the same-fixture `a24cce4` run, German adds one substitution (eight
  substitutions and one insertion now). English remains one substitution;
  mixed remains five substitutions and an inexact final-five suffix. Boundary
  and silence remain error-free. No scored deletions or repeated-phrase
  insertions. Finals: German 731 ms, boundary 600 ms, mixed 470 ms, silence
  3 ms, English 646 ms. Completion recovery is not a quality gain; this run's
  lexical score is slightly worse than the prior 14/142-edit candidate.
- Paced five-minute stock-code/real-GPU integration: **0/1 finals**, failing at
  the thirteenth attempted window after **114.176 seconds accepted** and 12
  successful merges. No final, WER/CER, tail score or final latency exists.
  Queue peak 16.984 seconds; unprocessed coverage 16.896 seconds including
  lookahead. GPU memory 551 MiB baseline, 2918 MiB peak, 551 MiB after disposal.
  This is a failed five-minute test, not a shortened success.

The saved-hypothesis diagnostic passes the reported window-5 and window-18 cases,
but sequential reassembly stops at #13. Independent adjacent-window checks reject
#13, #20, #24, #26, #28 and #34 with the symmetric guard enabled (27/33 pass).
Those checks are not a complete transcript or paced evidence. In particular,
passing the constructed repeated-tail regression does not mean the actual final
saved boundary #34 succeeds; it is rejected. No all-34-window success is claimed.
Keep the recovered-word mechanism for review, reject release qualification.

## Previous qualification: timed substitutions (`a24cce4`)

**Five-minute qualification still fails.** Clean
`a24cce4edbcad07e20dc67d4cfedd7b64c212721` pairs overlap-prefix words monotonically,
permits time-coincident one-for-one substitutions, and still rejects unmatched
insertions/deletions. Substitutions keep the old spelling through the anchor;
fresh corrected suffixes remain eligible. Left-clipped old words are prior
context, not wholly available in the fresh audio. Exact negation/recovered-word
and phantom adversaries, genuine repetitions, and corrected-tail tests pass.

- Rapid: **5/5 finals**, WER **14/142 = 9.86%**, CER **29/899 = 3.23%**. These
  are the same edit counts as the previous successful rapid profile, not a new
  recognition-quality gain. German has seven substitutions and one insertion;
  English one substitution; mixed five substitutions and an inexact final-five
  suffix. Boundary and silence have zero edits. German's first final is 781 ms;
  boundary/mixed/silence/English finals are 604/488/3/668 ms. No deletions or
  repeated-phrase insertions were scored. One run per fixture is not a robust
  latency distribution or real-microphone qualification.
- Five-minute paced stock-code/real-GPU integration: **0/1 finals**. It passes
  the earlier for/four conflict but rejects the thirteenth attempted window after
  **114.176 seconds accepted**, with 12 successful merges. No final, tail score,
  WER/CER or final latency exists. Queue peak is 17.480 seconds, unprocessed
  coverage 16.980 seconds including lookahead. GPU memory: 551 MiB baseline,
  2821 MiB peak, 551 MiB after disposal. Remaining fixture audio is not delivered
  after the error; this is not a successful five-minute recording.

Offline replay of saved hypotheses separately passes the first 12 windows and
rejects window 13, where fresh output omits old words within shared audio. That
diagnostic explains a remaining ambiguity; the paced run records the same window
failure but does not itself save raw per-window hypotheses. Keep the substitution
rule as a tested candidate, reject full quality/long-duration acceptance. All
earlier candidate failures and the old successful `9d27248` result remain in the
append-only ledger with their original source attribution.

## Previous qualification: symmetric prefix proof (`73aaec5`)

**Reject release and five-minute qualification.** Both overlapping prefixes must
now be confirmed before the splice: not only discarded fresh words but retained
old words inside the fresh audio window. Exact fresh-only, symmetric old-only,
correction, repetition and tail regressions pass. These guarantees are narrower
than successful recognition, and the conservative rejection rate is not usable
recording reliability.

Clean `73aaec5fc71c194c417ccf9a9fda0d78613fb1bf`, same model/fixtures/settings:

- Rapid **3/5 finals**: German and boundary both fail alignment at 20 seconds
  accepted audio. Mixed, silence and English complete in 519, 4 and 800 ms.
  Mixed has five substitutions and an inexact final-five suffix; English has
  one substitution; silence has no false words. The successful subset has no
  scored deletions/insertions and WER 6/68 (8.82%), CER 11/405 (2.72%). These
  exclude two failed fixtures and are not a comparable aggregate quality gain.
- Five-minute paced stock-code integration **0/1 finals**: third attempted
  window fails after **32.768 seconds** accepted; two windows had been merged.
  No final, final latency, tail score or WER/CER exists. Buffered audio peaks at
  17.096 seconds; unprocessed coverage peaks at 16.896 seconds including lookahead.
  The rest of the fixture is not delivered after error. This is a failed test,
  not a completed five-minute recording.

Keep the conservative ambiguity guard; reject qualification. Both runs are
appended to the ledger. Earlier one-sided-guard and pre-guard results follow as
historical evidence; no newer failure overwrites the measured `9d27248` result.

## Previous qualification: fresh-prefix proof (`94bda99`)

**This revision's five-minute qualification fails.** Previous successful five-minute
results below used a weaker merge and do not qualify this revision. The old
latest-anchor splice could silently delete a freshly recovered negation. The
new rule requires all discarded fresh words to belong to the contiguous timed
matching sequence; otherwise it fails the whole session without a final.

Both new runs used clean commit `94bda998fabad94e7b1af1cba4f4e15ec90fa6c9`, the
same medium/float16/beam5 model and fixed manifests. No inference setting changed.

- Rapid: **4/5 finals**. `long-de20` fails with "could not align all words at a
  chunk boundary" after 20 seconds accepted. Boundary, mixed, silence and English
  finish in 635, 521, 4 and 754 ms respectively. English retains one substitution;
  mixed retains five substitutions and fails the final-five-word check. Boundary
  and silence have no lexical errors. There are no scored deletions, insertions
  or repeated-phrase insertions in the successful subset. Its WER 6/107 = 5.61%
  and CER 11/680 = 1.62% exclude failed German and **cannot be compared as a quality
  gain** against the prior five-fixture aggregate.
- Five-minute fixture, paced stock-code/real-GPU integration: **0/1 finals**.
  The fifth attempted window fails the same prefix-proof check after **49.152
  seconds** of accepted audio; four windows had been merged. The remaining
  fixture is not delivered after error. No final transcript, tail-completeness
  score, WER/CER or final latency exists. This is a failed five-minute test, not
  a shortened successful recording. Maximum buffered audio was 17.480 seconds;
  maximum unprocessed coverage (including lookahead) was 17.408 seconds. GPU
  memory was 551 MiB baseline, 2797 MiB peak, 551 MiB after disposal.

Keep the deletion guard; reject current release/long-dictation qualification.
Explicit rejection is safer than claiming a transcript with silently discarded
fresh words, but it loses the session's text and is not acceptable recording
reliability. A future reconciliation change must account for competing overlap
hypotheses and be measured again, not merely restore the higher callback count.
The append-only ledger retains both new failures and the earlier results.

## Historical candidate measurements

Initial screens are dirty-tree experiments with per-artifact hashes in the
append-only [ledger](experiments.jsonl). They are development evidence, not a
clean-release comparison. The same five 20-second fixtures were used throughout.

| Profile | Finals | Pooled WER / CER | Decision |
| --- | --- | --- | --- |
| Whole-utterance medium/float16/beam5 | 5/5 | 19.72% / 11.90% | Comparator only; mixed-language omissions |
| 8-second / 2-second overlap | 4/5 | Incomparable successful subset | Reject: German seam failure |
| 16-second / 4-second overlap | 5/5 | 19.01% / 11.12% | Retain for exploration, reject quality acceptance |

The 16/4 profile had 11 deletions in the mixed fixture and failed its final-five-word
check. German had seven substitutions and one insertion. English had one
substitution; the dedicated boundary fixture had zero lexical edits. The aggregate
one-error difference versus whole inference does not establish a quality gain.
Adjacent duplicate-insertion count was zero in this small screen; that is not a
proof against other boundary duplicates. Edit alignment has deterministic ties,
and the final-five check is exact normalized text, not a human semantic judgment.

All five 16/4 final callbacks arrived within 843 ms in this one screen, including
silence (3 ms). There are too few observations for a reliable p95. One separate
stock-composer/actual-relay/real-worker replay of the English clip inserted editable
text after 5017 ms; the provider final arrived after 836 ms. Input and relay audio
SHA-256 matched and only Talk RPC methods occurred. This validates the harness and
that specific path; it is not a real browser/network/microphone recording.

Next experiment: prefer a detected pause when available, with a 16-second forced
maximum and time-aware overlap alignment. Endpoint selection never drops audio;
quiet speech can still be split incorrectly and must be tested on real microphones.
The existing stock 30-minute relay TTL remains an independent obstacle to OG's
60-minute ceiling requirement. No core patch is made.

The pause-aware follow-up completed 5/5 finals, with zero aligned deletions on
these fixtures; the mixed final-five check still failed. Its decision is to proceed
to longer integration evaluation, not accept microphone quality. RMS-based pause
selection does not remove audio and can still split quiet syllables incorrectly.
The planned five-minute replay is an in-process stock-code integration with mocked
capture/RPC transport, not a real microphone recording.

## Clean paired rapid check and first five-minute run

At clean commit `139344a`, the same five rapid fixtures yielded 5/5 finals for both
whole inference and pause-aware chunking. Whole: 28/142 word edits (19.72% WER),
107/899 character edits (11.90% CER). Chunked: 14/142 (9.86%), 29/899 (3.23%).
The chunked mixed clip still has five substitutions and fails its final-five check;
German has seven substitutions and one insertion. No aligned deletions occurred
in this rapid chunked set. These are measured improvements on this small synthetic
development corpus, not evidence of general, real-mic, or Swiss-German gains.
Only four warm latency observations per mode, including silence: whole median
1100 ms, maximum 2239 ms; chunked median 522 ms, maximum 663 ms. The first German
chunked callback took 948 ms. Order was baseline then candidate, not a randomized
crossover, and power/thermal/background load were not controlled.

The first five-minute run used clean `e63aac6`. All 2,400,000 PCMU bytes reached
the provider unchanged through stock encoding/controller/relay. It completed
34 windows, peaked at 17.512 seconds queued (the 32-second bound includes context),
and took 573 ms Stop-to-provider-final / 5007 ms Stop-to-composer commit. GPU memory
was 551 MiB baseline, 2829 MiB peak, and 551 MiB after disposal; sampled mean GPU
utilization was 18.43%, peak 100%. This is host-wide sampling, not per-process
attribution. Unprocessed audio coverage peaked at 17.408 seconds; that metric
includes window lookahead and is not extra inference backlog.

Quality **failed complete-transcript acceptance**: 42/611 word edits (6.87% WER),
127/3819 character edits (3.33% CER): 27 substitutions, eight deletions, seven
insertions. Six inserted words repeat an earlier phrase. Exact final five words
match, but the final-20-word edit count is 11: a suffix match alone is insufficient.
The German sentence beginning “Im Nebenraum” was omitted in the model hypothesis.

An offline window trace separated model and stitcher errors. The model generated
a repeated phrase near the last boundary, and the old latest-token anchor wrongly
retained part of it despite a corrected next hypothesis. The stitcher now prefers
a contiguous time-consistent token run; a deterministic regression covers that
failure. Reassembling the recorded window hypotheses removes the repeated tail
and yields zero last-20-word edits; this is an offline diagnostic, not a new paced
latency run. A corrected five-minute replay is required before accepting the fix's
whole-path result. The first debug feeder attempt hit backpressure because it did
not await an automatically scheduled job; it is recorded as inconclusive.


## Corrected five-minute milestone and final rapid regression

Clean `9d27248` repeated the full 300-second in-process path with contiguous-run
alignment. All 2,400,000 input bytes again matched at provider ingress. The stock
composer commit callback received the assembled final, marked late, and no chat-send
RPC occurred. **Provider final: 551 ms; stock commit: 5008 ms.** The 34 windows took
at most 1378 ms each. Queue peak was 17.480 seconds / 139,840 bytes against 32 seconds;
unprocessed coverage peak was 16.980 seconds, including window lookahead. GPU
memory: 551 MiB baseline, 2829 MiB peak, 551 MiB after disposal. Sampled host GPU
utilization averaged 9.55% and peaked at 100%; uncontrolled host activity means the
lower utilization than the first run is not a claimed efficiency improvement.

Quality: **35/611 word edits (5.73% WER), 99/3819 character edits (2.59% CER)**:
26 substitutions, eight deletions, one insertion. The six-word repeated suffix is
removed; repeated-phrase inserted-word count is zero and the final 20 words match
exactly. The omitted German sentence remains absent from the model hypothesis.
**Keep the bounded-throughput/tail-correction milestone; reject full transcript
quality acceptance.** Two synthetic paced runs are not an hour-long soak, and
there is no measured five-minute full-utterance quality comparator or real-mic claim.
For that profile, this corrected paced result supersedes the first 42/611-edit
run; both remain archived. It predates both conservative prefix-proof changes.

The final rapid regression at clean `923cf52` has the same measured runtime source
hashes as the corrected five-minute run. It again completed 5/5 fixtures: 14/142 word
edits (9.86% WER), 29/899 character edits (3.23% CER), no aligned deletions or repeated
inserted phrases. Compare against `long-whole-clean` above, with identical fixtures,
model and worker settings: the improvement is confined to this synthetic corpus.
The mixed clip still has five substitutions and an inexact final-five suffix;
German still has seven substitutions and one insertion. Warm final median was
511 ms, maximum 693 ms (n=4, including silence); first German final was 849 ms.
There is insufficient data for a reliable tail percentile or microphone acceptance.

A separate owned-child idle check used a one-second test setting: memory moved
551 → 2587 → 551 MiB, and the exact worker PID exited. No other process was killed.

The final harness also treats an empty provider final correctly: stock silence
completes with no composer insertion and no send, rather than a false test error.
That branch is tested with the actual relay/stock code and a deterministic worker.
No production code or inference setting changed for that harness correction.
