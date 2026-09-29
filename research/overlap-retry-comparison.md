# Paired overlap-retry comparison

## Plan

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

Decision: default `overlapRetry: false`; retain explicit opt-in true for future
measured research. No measured recognition or human-review benefit justifies the
extra work in this screen. This does not prove a third reading never helps.
Preserve both labeled readings and all semantic guards. Proceed with one paced
five-minute no-retry validation; overall quality acceptance remains unresolved.
