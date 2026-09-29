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
unresolved. Presentation removes lexically duplicate readings and factors shared
ordered shared words outside localized choice spans, while empty alternatives
remain explicit. Up to three readings of 512 tokens use bounded dynamic programming;
larger inputs fall back to prefix/suffix factoring without truncation.
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

- 71 Node and 18 Python deterministic tests pass, including maximum worker framing,
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
  After the retry/marker candidate `ab6422c`, package build/check and extracted-artifact loader were rerun
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
  after a valid first anchor. `a6911b9` prevents that omission; `e0157ce` deduplicates
  and factors shared boundaries. Current clean `ab6422c` factors interior agreed
  words into localized choices. The rapid gate passed first: 5/5, two uncertain
  joins/four spans/132 marker characters (versus 527), zero repeated-phrase inserted
  words, visible WER/CER 23.94% / 14.57%. The subsequent paced 300-second run
  preserves all 2,400,000 audio bytes and completes 34 windows. Eight retries cost
  8439 ms; eight joins render as 23 spans/813 characters versus 2050. Provider final
  1452 ms, stock insertion 5006 ms, no Send. Visible WER 147/611 (24.06%), CER
  672/3819 (17.60%): 34 substitutions, three deletions, 110 insertions, including
  choices/labels. Nine repeated-phrase inserted words remain; visible final-20
  errors 12, final five exact. Marker relocation affects that tail metric; no tail
  completeness claim. Re-rendering prior readings reproduces all six fresh drafts
  exactly, proving presentation change, not ASR improvement. Keep the editorial
  format, but do not claim general usability, release or microphone acceptance.
  These tests use actual stock code with simulated capture/DOM/RPC and real GPU.
- Audit of those same complete runs finds **0/10 real GPU retries resolved a join**
  (rapid 0/2, five-minute 0/8). Five-minute retry decode work is 8439 ms on top of
  28427 ms normal decode, a 29.7% increment. This is wall time; host GPU samples
  cannot isolate retry cost. Mock resolution tests are not quality evidence.
  A third reading may aid review, but its value is unvalidated. No retry benefit
  or policy improvement is claimed; a short no-retry comparator should precede
  changing the default or spending another long recording on that question.

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
