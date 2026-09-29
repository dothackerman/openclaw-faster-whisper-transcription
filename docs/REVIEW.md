# Kappa review handoff: long dictation

Current branch implements OG's continuous-dictation choice. No short recording
cap remains. No core/UI patch, live install, host config edit, Gateway restart,
credential use, or push was performed. This remains an experimental prototype.

## Architecture and source constraints

One instance-owned Python worker, one admitted session, one inference lane.
Pause-aware endpoints use 20 ms RMS frames, threshold 0.005 full scale and 600 ms
quiet after activity, with a four-second minimum window. Audio is never removed
by this detector: both sides include 250 ms padding around the pause centre.
Continuous speech forces a 16-second window with four-second overlap. Contiguous timed
word/token sequences reconcile overlap; ambiguous active overlap rejects the
automatic merge and enters bounded retry/marking.
All hypotheses stay internal until one final; stock composer inserts editable
text and sends nothing. Final drain is one 4.5-second budget including in-flight
work. Silence endpoints are engineering hypotheses, not mic-qualified VAD.

Queue: 32 seconds / 256,000 PCMU bytes, previous/current windows of at most
128,000 bytes each, and one at-most-160,000-byte retry (672,000 bytes total PCMU).
Worker request capacity: 30 seconds / 240,000 bytes, with derived base64 framing.
Worker response: 64 KiB, 512 timed words, 16,000 text characters. Final transcript:
160,000 characters / 24,000 words. Wall/audio ceiling: 60 minutes. All overflow,
crash/OOM and timeout failures insert no successful truncated prefix. Ambiguous
seams receive one bounded context retry, then visibly marked alternatives if
unresolved. Presentation removes exact NFC duplicate readings. Only identical, unique,
monotone words with compatible timing appear outside localized spans; empty
alternatives and punctuation/case differences stay explicit. At most three
512-token readings use bounded pairwise order checks; larger readings stay whole
inside a marker without truncation.
Marked insertion is reviewable completion, not quality acceptance.
The fixed stock-host 30-minute TTL prevents actual 60-minute browser sessions;
a host deviation needs Kappa approval before implementation.

`maxAudioSeconds` and `snapshotIntervalSeconds` were removed; stale configurations
fail validation. Dedicated provisioning, lazy model load, idle process eviction,
managed disposal, safe logs, and rollback/install instructions remain.

Both incoming long-duration notes were read and checked against the prepared
source and pinned Faster-Whisper implementation; their files were not overwritten.
See [source evidence](../research/long-duration-implementation.md),
[plan](LONG-DURATION-PLAN.md), and [results](../research/LONG-DURATION-RESULTS.md).

## Verification

- 89 Node and 18 Python deterministic tests pass, including maximum worker framing,
  independent audio/time ceilings at 60 minutes, serial overlap/tail draining,
  queue overload, pre-ready frames, cancellation, timeout, OOM/crash, disposal,
  invalid word timestamps, repeated-word seams, silence endpoints, and edit scoring.
  New regressions retain a fresh overlap negation through the provider's only
  final, reject ambiguous leading overlap, and reject subset-manifest reference/hash drift.
  The exact `alpha@5 / recovered@5.5 / anchor@7 / tail@8` repro now retains the
  recovered word using only the initial fresh prefix anchor. A leading substitution
  enters bounded retry/marking even with two following exact timed words;
  the fresh suffix always remains. Every replaced old lexical word must survive
  monotonically in the fresh overlap; missing or changed words enter retry/marking.
  Exact old-only negation, repeated-word counts and can/cannot regressions pass.
  Python checks text/word coverage per segment,
  and Node independently checks total lexical coverage for timestamped replies.
  Missing words fail without emitting a successful partial transcript.
  Old-only words fully within new audio before the first anchor fail when at
  least 200 ms separates their end from the first fresh token; uncertain nearby
  or overlapping timestamps are retained. Exact trace #13 and threshold cases pass.
  This includes exact old `phantom@6, anchor@7` versus fresh `anchor@7, tail@8`
  in a window beginning at 6 seconds; the merge explicitly rejects the phantom.
- Four tests through the unmodified stock composer pass: reproduce stale partial
  insertion, retain the asynchronous final tail, insert no prefix on overload,
  and suppress late insertion after composer disposal.
- Actual host relay/manifest/SDK contract smoke passes. Three deterministic whole-path
  tests cover nonempty insertion, silence and exact uncertainty-marker text with no send through the actual
  relay and stock encoding/controller. The fake-clock TTL test proves the 30-minute
  host obstacle. Native loader/catalog/disposal passes on the extracted npm artifact.
  After the labeled-choice candidate `f558a9a`, package build/check and extracted-artifact loader were rerun
  sequentially and passed; no concurrent `dist` rebuild occurred during loading.
  Source was read-only.
- Published SDK remains an exact locked development dependency; no stub or vendored
  declaration. The prior clean-clone CI-equivalent checks pass (34 Node, 13 Python,
  formatting, 12 fixture hashes and the 33-file package allowlist). Public CI of this
  new chunked milestone is pending review/push.
  The subsequent local 35th Node regression proves exact 18,019-character final
  assembly across 20 windows, exceeding the worker's per-window text limit.
- A 20-second synthetic replay through stock capture encoding/controller, actual
  relay, and real GPU worker passed exact audio hashes and editable late insertion
  with no chat-send RPC. The first five-minute run completed transport/insertion but exposed a
  repeated-tail stitching bug, now covered by a regression and fixed. A corrected
  historical five-minute run at `9d27248` passed byte integrity and tail regression: 551 ms provider final,
  5008 ms stock commit, zero final-20-word edits, 5.73% WER / 2.59% CER. Model
  recognition still has 26 substitutions, eight deletions and one insertion;
  this is not complete-transcript quality acceptance.
  These completion metrics predate the stricter fresh-prefix proof at `94bda99`
  and do not qualify the current implementation. The stricter unmarked `1a3f6fc`
  failed at window #24 after 212.480 seconds. Subsequent `036514b` and `565b9d1`
  completed with one/two markers but still silently discarded old-only words
  after a valid first anchor. `a6911b9` protects old-only words; `ab6422c` adds
  localized choices. Previous clean `3eabf11` additionally seals crossing words
  into the alternative, retains atomic NFC Word surfaces and punctuation/case choices and hoists
  only unique, monotone, time-compatible common text. Rapid passed first: 5/5,
  two joins/four spans/123 characters, zero repeated-phrase insertions, visible
  WER/CER 18.31% / 10.90%. The subsequent paced 300-second stock-code run preserves
  all 2,400,000 audio bytes and completes 34 windows. Eight joins yield 25 spans/
  947 characters; provider final 2238 ms, stock insertion 5010 ms, no Send.
  Visible WER 131/611 (21.44%), CER 626/3819 (16.39%): 25 substitutions, eight
  deletions and 98 insertions, including choices/labels. Five repeated-phrase
  inserted words remain; visible final-20 errors 14, final five exact. Keep the
  correctness fixes; do not claim verified quality, tail completeness, general
  usability or microphone acceptance. This is actual stock code with simulated
  capture/DOM/RPC and real GPU.
- Retry audit on these completed clean runs: **0/10 real GPU retries resolved**
  (rapid 0/2, five-minute 0/8). Five-minute retries cost 9209 ms on top of 30964 ms
  normal decode (29.7% extra wall time). Host GPU samples cannot isolate retry
  cost. A third reading may aid review, but its value remains unvalidated; no
  quality, latency or default-policy improvement is inferred.

Current `f558a9a` preserves source labels across every disputed gap; exact
alternatives merge labels instead of losing source identity. Reconstruction tests
select a consistent label, including omissions and fallback. Rapid5/5 delivered;
four spans/211 characters; visible WER34/142 (23.94%), CER173/899 (19.24%).
Removing labels yields the preceding `3eabf11` texts exactly. German23/35 edits,
English6/74 (boundary exact), mixed5/33, silence0 words. No repeated-phrase
insertions. Both retries remain marked, costing3555ms. Maximum final latency3016ms.
This is extra editorial overhead, not a quality gain. Keep semantic safeguard,
reject quality acceptance; no new paced five-minute run after rapid regression.
The five-minute numbers above are historical and do not qualify this format.

## Experiment and public-data boundary

Append-only decisions, including rejected profiles, are in
[experiments.jsonl](../research/experiments.jsonl). Historical full-utterance
screens remain attributed to their old commits, not the current implementation.
Early long-duration screens are dirty-tree development runs; final milestone runs
must capture a clean commit and source hashes. No quality gain is inferred from
callback completion. Mixed-language tail errors remain a qualification concern.

All twelve public audio files are generated eSpeak NG from self-authored scripts,
with hash manifests. The new five-minute script is non-looped, with paragraph
pauses; it is not five minutes of continuous speech. No OG private audio/transcript
is used or tracked. Local detailed hypotheses, telemetry and runtime/model files
stay ignored. The package excludes fixtures, research, tests, local results,
environments, model weights and the SDK dependency tree. Project code is MIT;
separately provisioned dependencies keep their own licenses.
The fixture CI gate now also requires both rapid/five-minute subset manifests
to match the canonical long manifest exactly, including references and metadata.

## Remaining acceptance limits

No real browser/network/microphone or Swiss-German acceptance, no hour-long soak,
no production deployment, and no claim that 30/60-minute stock-browser recording
works. The in-process composer harness simulates microphone input and RPC transport;
it exercises stock UI/relay code but cannot test device/browser/network behavior.
The browser itself has a 10-second pre-creation buffer and no bounded post-creation
RPC queue. These host-owned behaviors are outside a provider-only implementation.

Ceiling follow-up: [exact audit](../research/ceiling-lifecycle-audit.md) retains
the abort/data-loss behavior as a release limitation. Six stock-controller tests
now include final/completed-close and final-then-error counterexamples; neither
is a safe automatic completion protocol. No runtime or host change is made.
