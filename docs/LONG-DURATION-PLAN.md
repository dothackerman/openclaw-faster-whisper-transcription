# Long dictation implementation and experiment plan

Current boundary/editorial screen: fresh words starting before the old seam end
belong to its alternative even when they end after it. Extend sealing through
the connected overlap of old/fresh/retry words; only words starting beyond that
region remain tail. This avoids a crossing contradiction appearing as definite
speech or reappearing in the next window.

Render exact NFC surface choices, retaining punctuation/case distinctions. Hoist
only words unique in each reading, monotone across every reading, and within
0.8 seconds midpoint range across every supplied word span. Repeated, reordered
or time-incompatible candidates stay marked. There are at most three readings,
512 tokens each and 512² pairwise order checks; larger inputs remain as whole
alternatives, never truncated. All production rendering receives timed words.
Run deterministic seal/render tests and rapid fixtures first. Only consider a
paced rerun after complete rapid finals and review of visible burden; do not
inherit qualification from the earlier seam partition.

Current uncertainty experiment: retain the preceding 16-second audio window and
attempt at most one wider-context decode (20-second cap) per ambiguous boundary
on the same serial GPU lane. During Stop, retry only if the remaining original
4.5-second budget exceeds max(500 ms, 1.5 × last decode time); this estimate never
extends the deadline. A retry is unmarked only if both prior word sequences
survive monotonically with timed matches, followed by successful reconciliation.
Otherwise seal localized `[uncertain: option | option]` spans and continue.
Presentation keeps safely agreed exact NFC surfaces once; punctuation/case
alternatives remain distinct. Empty choices stay `(no words)`. No preferred reading is selected.
A sole deduplicated reading still carries a marker because timing may be ambiguous.
A skipped retry supplies no third reading. Sealed markers cannot be rewritten by
later windows; subsequent fresh tail words remain editable.

Peak retained PCMU is bounded by the 32-second rolling queue, 16-second previous
window, 16-second current snapshot and 20-second retry: 672,000 bytes, excluding
JSON/float conversion and model memory. Text/word caps include markers and all
alternatives. OOM/crash/overflow and deadline failures still fail explicitly.
This change does not repair host TTL or plugin-ceiling data loss.

Qualification: missing-negation/phantom and marker persistence tests; cancellation
and final-deadline tests during retry; actual stock-composer editable marker with
no chat-send; clean rapid and paced five-minute runs recording marker count,
retry count/audio duration/decode time, queue lag and GPU use. Score the verbatim
marked final, never choose a best alternative for an optimistic WER. Marked
completion is a reviewable draft, not verified transcript quality acceptance.

OG's requirement supersedes the provisional short cap: continuous capture, with
an explicit 60-minute safety ceiling and no successful truncated result on failure.
The stock 2026.9.6 composer/relay still require final-only callbacks and a total
4.5-second provider drain. No core/UI or production configuration changes.

Implementation: one serial GPU lane, bounded rolling PCMU audio, overlapping
bounded windows during capture, timestamped words and token/time seam alignment.
Retain only a short uncommitted transcript/audio tail; accumulated final text has
an independent size bound. No full-recording audio retention. The initial 8-second / 2-second candidate failed a German seam. The next candidate
uses pause-aware endpoints with a 16-second maximum / 4-second forced overlap;
this is not a latency guarantee. At Stop,
drain the in-flight window and remaining tail under one deadline. If backlog,
model/worker failure, ambiguous seam, text bound, or lifetime ceiling prevents a
complete final, fail closed with an explicit error and no successful transcript.
Callbacks never expose internal partials; final text remains editable before Send.

Keep model loading/idle eviction and disposal ownership; accept bounded audio
while connecting. The maximum recording duration, audio queue capacity, maximum
per-request window, and response/text limits are distinct. Remove obsolete full
utterance/snapshot settings; reject obsolete configurations with migration docs.
Add non-content diagnostic counters for queue lag, window timing and seam choices.

Validation: deterministic serial/backpressure/tail/cancellation/OOM/reload and
60-minute boundary tests; exact stock-composer behavior; real Node/Python framing;
clean published-SDK CI and package boundary. Measure synthetic English, German,
mixed language, silence, and boundary words using non-looped ~20-second scripts.
Compare the same fixtures against full-utterance inference, recording WER/CER,
insertions/deletions, repeated-word errors, tail words, Stop-to-final, queue lag,
and GPU memory/load. Then run five minutes of paced, non-looped audio through the
provider and stock composer harness. No microphone or Swiss-German claims from
synthetic speech. Append all keep/reject/inconclusive decisions to the ledger.

Read incoming research/long-duration-host-contract.md and
research/long-duration-quality.md when present, without overwriting them. Verify
against the prepared host and pinned Faster-Whisper/CTranslate2 sources. Persist
our independent evidence in research/long-duration-implementation.md.

Host obstacle verified: stock relay expires at 30 minutes without renewal. A full
60-minute browser session needs an approved host change; none is made here.

Available paths: keep the stock host and manually finish/restart recordings well
before expiry, accepting that this does not meet uninterrupted hour-long dictation;
or separately authorize an upstream host change with a longer transcription-only
lifetime and expiry final-drain semantics. Changing only the timer constant would not resolve
the current expiry path's loss of late finals. Neither path is deployed here.

The independent [host lifetime review](../research/host-ttl-change.md) recommends
an approximately **65-minute host guard for a 60-minute recording ceiling**.
Host TTL starts at session creation, not at a guaranteed recording-start boundary;
startup, queued audio delivery and the five-second final drain need headroom.
Exactly 60 minutes of host TTL therefore does not guarantee 60 minutes of recording.
65 minutes is a proposed internal guard, not supported recording duration or an
existing configuration option. A targeted fixed transcription TTL is the smaller
upstream proposal; configurability would require additional schema/runtime work.

That separate change must also keep an expiring relay registered during bounded
final drain, visibly auto-Stop capture at the recording ceiling, and surface an
unexpected timeout while preserving any confirmed final for editable insertion.
Current expiry deletes the relay before drain and labels it completed; stock
capture may continue until a later append fails, losing the entire final-only
transcript. Raising TTL alone or changing only the error label does not fix this.
Real-browser/microphone and near-60-minute boundary tests remain required; the
five-minute synthetic source-level replay does not qualify those behaviors.
The current plugin ceiling also aborts and discards all session text; it is a
memory/time guard, not a safe auto-finalization feature. Hour-long acceptance
requires capture-stop acknowledgement and final-drain/recovery behavior at both
host expiry and the plugin ceiling. See [exact loss and callback behavior](STOCK-COMPOSER.md).

The worker's 16,000-character text and 64-KiB stdout limits apply to individual
windows. The complete transcript is assembled in TypeScript, separately bounded
to 160,000 characters / 24,000 words. A provider regression assembles 20 bounded
window responses into an exact 18,019-character final without partial callbacks.
Current queue capacity is 32 seconds, transcript cap 160,000 characters / 24,000
words, and per-worker request ceiling 30 seconds (also used by short offline
comparators). These are distinct bounds. Browser RPC backpressure and its own
pre-creation 10-second buffer remain host limitations.

Completed evaluation and rejected alternatives are recorded in
[LONG-DURATION-RESULTS.md](../research/LONG-DURATION-RESULTS.md). The corrected
five-minute synthetic integration at `9d27248` met its measured final budget and
final-word check but retained model recognition errors. It predates the stricter
fresh-prefix overlap proof at `94bda99`; current qualification must use the new
failure evidence, not inherit that completion result. Real microphone/Swiss-German acceptance
and the host change needed for an actual 60-minute session remain outside this
prototype's verified support.
