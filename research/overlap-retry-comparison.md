# Paired overlap-retry comparison

## Final same-build paired evidence — `925cf98`

Independent QA supplied four clean runs from
`925cf985884956a47bea726815eb5833aeef3cf4`. Artifact metadata and recorded source
hashes match; each pair uses identical model, fixture manifest and harness hashes,
with only `overlapRetry` changed. Scores include the complete visible draft,
including labels and every alternative. Raw outputs and score files remain local.

| Rapid (five fixtures)        |       Retry off |        Retry on |
| ---------------------------- | --------------: | --------------: |
| Successful finals            |             5/5 |             5/5 |
| Visible word edits / WER     | 34/142 / 23.94% | 34/142 / 23.94% |
| Visible CER                  |          17.02% |          19.24% |
| Markers / characters         |         4 / 178 |         4 / 211 |
| Retry decode                 |            0 ms |         2332 ms |
| Normal decode                |         6796 ms |         7158 ms |
| Warm final p95 (exploratory) |          658 ms |         1590 ms |
| Peak host VRAM               |        2797 MiB |        2797 MiB |

| Paced five-minute stock-source composer  |        Retry off |         Retry on |
| ---------------------------------------- | ---------------: | ---------------: |
| Duration / normal windows                |       300 s / 34 |       300 s / 34 |
| Visible word edits / WER                 | 175/611 / 28.64% | 179/611 / 29.30% |
| Visible CER                              |           24.85% |           28.38% |
| Markers / characters                     |        25 / 1280 |        25 / 1496 |
| Retries / extra decode                   |         0 / 0 ms |      8 / 7086 ms |
| Normal decode                            |         26870 ms |         24582 ms |
| Provider final latency                   |           753 ms |          1331 ms |
| Composer insertion latency               |          5010 ms |          5007 ms |
| Peak host VRAM                           |         2829 MiB |         2797 MiB |
| Final-20 edits / repeated inserted words |           13 / 5 |           13 / 5 |

Both long runs preserve fixture/input/relay audio SHA-256
`e5e30c6d5c59062dcbc52ee7fddf0335e9111fab425ec17fa381db2299da5255`
and report no Send. Their overall harness final-return times are approximately
5011/5008 ms (off/on), distinct from the insertion timings above. GPU memory and
utilization are host-wide, not isolated to the plugin; infer no VRAM win. Decode
milliseconds measure wall time, not isolated GPU kernel cost. One pair does not
establish population-level latency or quality differences.

**Decision: keep default off for these synthetic fixtures; retain the configurable
switch.** Retry adds work and editorial text without a measured benefit here.
Do not generalize this to ASR or human-review quality gains. Quality remains
experimental and usability acceptance is not established. This is a paced
stock-source harness with simulated capture/DOM/RPC, not real browser/Gateway/mic
validation. Swiss German and 60-minute recording remain unqualified; the stock
host's 30-minute expiry is still a blocker.

Append-only ledger IDs: `final-off-rapid`, `final-on-rapid`, `final-off-five`,
`final-on-five`. Local artifacts use those names with `.json` and `-score.json`.
The evidence update runs no new GPU experiment and changes no runtime or Gateway
configuration. Earlier nonpaired/other-renderer results below remain historical;
the missing same-build long pair noted there is now supplied by this section.

## Historical plan

Compare explicit `overlapRetry: true` and `false` on the same clean implementation,
medium float16 beam5, local dedicated runtime/model, same five synthetic rapid
fixtures and seeded order. Both policies keep the exact NFC atomic Word surfaces,
connected crossing seal, unique timed anchors and source-labeled alternatives.
Disabling retry skips extra inference; it does not suppress ambiguity or select
one conflicting reading as certain. Existing timeout/crash/coverage guards remain.

Measure visible WER/CER (including labels and alternatives), marker characters,
source readings, final latency, normal/retry decode wall time, and host VRAM.
Compare texts with and without labels only for diagnosis, not as a replacement
for the visible-draft score. GPU samples remain host-wide; decode milliseconds
are not isolated kernel time. A third alternative is not assumed to improve
human review. No microphone/dialect acceptance follows from synthetic fixtures.

Keep enabled as the provisional existing behavior while collecting the pair.
If no measured benefit justifies extra decode work, select disabled as default;
run one paced five-minute disabled replay only if the rapid comparison supports
it. Use historical labeled enabled evidence cautiously: there is no fresh labeled
five-minute enabled comparator, and older unlabeled results are not score-equivalent.
Record immutable profiles/commit/hashes in the append-only experiment ledger.
No live configuration, installation, core/UI change, or push.

## Paired rapid result — clean `72ca434`

Both profiles delivered5/5. Enabled/disabled visible WER both34/142 (23.94%);
CER173/899 (19.24%) versus153/899 (17.02%). Both have two uncertain joins/four
spans, zero repeated-phrase inserted words, exact boundary fixture and silence,
and identical per-fixture word-edit counts. Marker characters211 versus178.
Enabled spends4231ms on two retries; neither resolves. Disabled spends0ms.
Normal decode totals13764 versus7591ms, so host/timing variability is substantial;
do not attribute the full latency difference to retries. DE final3825/837ms,
EN2967/703ms; remaining boundary1094/644, mixed831/530, silence16/5ms.
Host VRAM baseline551MiB both, peak2829/2797MiB; not isolated process telemetry.

Decision: provisional load-oriented default `overlapRetry: false`; retain explicit opt-in true for future
measured research. No measured recognition or human-review benefit justifies the
extra work in this screen. This does not prove a third reading never helps.
Preserve both labeled readings and all semantic guards. Proceed with one paced
five-minute no-retry validation; overall quality acceptance remains unresolved.

## One no-retry paced validation — clean `fddd592`

300 seconds/34 windows, input/relay/fixture hashes match, no Send. Provider final
924ms; stock insertion5037ms. Eight uncertain joins/25 labeled spans/1280 marker
characters. Visible WER175/611 (28.64%), CER949/3819 (24.85%):34 substitutions,
3 deletions,138 insertions,5 repeated-phrase inserted words. Final20 errors13;
final5 exact. Normal decode35512ms; retry decode0ms/count0, skipped8. Queue peak
18.024s, max lag17.524s includes lookahead. Host memory baseline551MiB,
peak2829MiB. The modest rapid VRAM difference did not persist at this duration;
no general VRAM-saving claim. GPU samples remain host-wide.

Keep no-retry provisionally for eliminated extra inference with no word-edit
penalty on this rapid screen only. Five-minute quality cost is unknown. This run validates transport/finalization only: quality/usability
acceptance remains rejected. There is no same-format fresh retry-on five-minute
comparator, so older unlabeled five-minute scores are not a causal comparison.
A third reading's human-review value remains unmeasured. No claim of real-mic,
Swiss-German, or60-minute stock-host acceptance. Tests:91 Node/18 Python plus
six stock-controller and three stock-relay checks pass.

Reproduction uses explicit local profile copies differing only in overlapRetry,
then `node scripts/experiment.mjs PROFILE fixtures/public/rapid-manifest.json
OUTPUT 1 chunked` and `scripts/score_long.py OUTPUT`. For the paced composer mode,
use the README's stock-source harness invocation and five-minute manifest. Run
serially; retain the paired raw outputs privately and ledger hashes publicly.

## Historical QA qualification correction

The no-retry five-minute run uses the labeled renderer:175/611 word edits
(28.64%), CER24.85%,25 spans/1280 marker characters, final20 edits13. Historical
retry-on `3eabf11` uses the atomic UNLABELED renderer:131/611 (21.44%),947 marker
characters. These are not a same-renderer comparison and cannot establish the
quality cost of disabling retry. Equal rapid WER cannot resolve that uncertainty.

The configurable switch remains. Default off is explicitly provisional for load,
with a possible quality tradeoff. A same-build, same-renderer paired long retry-on/
off comparison after the seal and retry-frontier fixes is needed before claiming
five-minute quality parity. Existing long measurements also predate those P1
fixes. No additional experiment was run for this qualification correction; no
historical ledger entry is rewritten.
