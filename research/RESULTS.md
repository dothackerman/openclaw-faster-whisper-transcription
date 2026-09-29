# Evaluation results — 2026-09-29

Historical full-utterance implementation results. Current chunked evaluation and
acceptance limits are in [LONG-DURATION-RESULTS.md](LONG-DURATION-RESULTS.md).

**Not production-qualified. No real microphone or held-out quality evaluation.**
The append-only [ledger](experiments.jsonl) retains completed, rejected, and
interrupted experiments with hashes, settings, runtime versions, and reasons.
Only sanitized aggregate measurements are published; detailed local artifacts
contain synthetic transcripts and stay ignored.

## Fixed short corpus

Six public eSpeak NG fixtures, three repetitions each, replayed in seeded order
as 100 ms G.711 frames through the real provider/sidecar. Model medium, automatic
language detection, CUDA float16. Clean measured source commit `4af8dec`.

| Metric | Beam 5 baseline | Beam 1 comparator |
| --- | ---: | ---: |
| Completed final callbacks | 18/18 | 18/18 |
| WER | 37.14% | 38.10% |
| CER | 16.28% | 16.37% |
| Silence false-positive words | 0 | 0 |
| Warm provider-final median | 520 ms | 495 ms |
| Warm provider-final exploratory p95 | 1765 ms | 1874 ms |
| Cold ready, one observation | 1950 ms | 2084 ms |
| Peak host GPU memory | 3405 MiB | 3405 MiB |
| Matched initial host GPU memory | 551 MiB | 551 MiB |
| Observed incremental peak | 2854 MiB | 2854 MiB |

Latency has **17 warm observations** per profile, includes silence, and is
exploratory. Repetitions are not independent speakers/utterances. Baseline ran
before candidate, not a randomized candidate-order crossover. Telemetry uses a
five-second initial baseline and 200 ms samples; host totals include display and
other activity. These limitations prevent broad latency/memory claims. The stock
composer waits for relay close around five seconds after Stop, so this table is
**not browser insertion latency**. First-partial latency is inapplicable because
final-only callbacks are required to avoid losing the tail.

| Synthetic fixture | Baseline WER | Beam 1 WER |
| --- | ---: | ---: |
| English short | 10.0% | 10.0% |
| English technical | 10.0% | 10.0% |
| German short | 122.2% | 107.4% |
| German technical | 30.0% | 30.0% |
| Mixed German/English | 54.5% | 72.7% |

WER can exceed 100% through insertions. Manual inspection of the **synthetic**
short-German baseline output found English text, and mixed speech lost meaning.
This is a serious failure in this fixture set, not acceptable German quality.
The manifest's `language` field records synthesis voice; its `mixed` fixture uses
the German voice. We therefore report mixed speech separately by fixture rather
than misrepresenting the scorer's combined `de` grouping as German-only quality.
The artificial voice/acoustic path cannot establish performance on human mics.

**Decision: reject beam 1.** It does not improve the measured tradeoff: pooled
WER/CER and exploratory p95 are worse, and mixed-fixture WER regresses. Beam 5
remains a reference baseline, not a winning/qualified profile. No quality gain
is claimed. Investigate language detection on representative local recordings
before selecting decoding, VAD, language, or model alternatives.

## Duration stress

Both beam profiles produced **15/24 callbacks**, with **9/24 timeouts**. Every
English 30/60/120-second target failed 3/3 at the 4.5-second deadline. Near-15-second
samples completed 3/3 in both languages. Longer German callbacks often contained
implausibly little text; callback completion is not an accuracy pass.

These are repeated synthetic loops, not representative quality recordings. The
beam-1 duration run had a dirty tree and is not release-selection evidence.
See [exact lengths, timing ranges, and the chunking decision](../docs/DURATION-DECISION.md).
Longer uninterrupted dictation is not supported merely because a buffer can hold
it. OG has since decided on continuous dictation with no short recording cap and
a 60-minute technical safety ceiling if needed. That decision supersedes this
full-utterance screen's provisional duration policy; see the
[chunked implementation results and remaining host limitations](LONG-DURATION-RESULTS.md).

## Resource lifetime

An isolated idle-eviction smoke set `idleSeconds=1`, loaded the actual medium model,
closed the session, and verified the owned child PID ceased to exist. Host GPU
memory changed **551 → 2587 → 551 MiB** (before/load/after idle). Full replay also
returned to 551 MiB after runtime disposal. This is observed cleanup evidence;
it does not establish an idle-time performance distribution or sole attribution
of every host GPU sample to the plugin.

## Remaining acceptance work

- Duration is decided and internal chunking implemented and compared. Safe
  hour-long recording still requires separately scoped host lifecycle changes
  and qualification; it is not supported by the stock host.
- Real browser capture and editable insertion with each actual mic; this cannot
  be replaced by the mocked-capture stock-controller regression.
- Consented private English/German/mixed and Swiss German recordings, with held-out
  scripts and human meaning/editability review. None were read or published here.
- At least 20 warm latency repetitions per relevant subset, paired longer idle
  baselines, candidate-order randomization, and measured cold-start capture.
- CI on the public remote and reviewed immutable production installation. Neither
  has occurred; no push, live config edit, install, reload, or restart was performed.
