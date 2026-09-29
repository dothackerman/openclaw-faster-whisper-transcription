# Long dictation: preliminary measured results

Status: experimental implementation ready for review; not release or microphone acceptance.
All speech here is self-authored, non-looped eSpeak NG synthesis transported as
8 kHz G.711 mu-law. The five-minute script has 218.332 seconds of synthesized
paragraph audio and padding to 300 seconds. Public manifests record every hash.
No private OG recordings, real microphone, or Swiss-German acceptance is claimed.

## Latest qualification: symmetric prefix proof (`73aaec5`)

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
