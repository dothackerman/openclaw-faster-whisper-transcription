# Long dictation implementation and experiment plan

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
five-minute synthetic integration meets its measured final budget and final-word
check but retains model recognition errors. Real microphone/Swiss-German acceptance
and the host change needed for an actual 60-minute session remain outside this
prototype's verified support.
