# Kappa review handoff: long dictation

Current branch implements OG's continuous-dictation choice. No short recording
cap remains. No core/UI patch, live install, host config edit, Gateway restart,
credential use, or push was performed. This remains an experimental prototype.

## Architecture and source constraints

One instance-owned Python worker, one admitted session, one inference lane.
Pause-aware endpoints use 20 ms RMS frames, threshold 0.005 full scale and 600 ms
quiet after activity, with a four-second minimum window. Audio is never removed
by this detector: both sides include 250 ms padding around the pause centre.
Continuous speech forces a 16-second window with four-second overlap. Timed
word/token anchors reconcile overlap; ambiguous active overlap fails explicitly.
All hypotheses stay internal until one final; stock composer inserts editable
text and sends nothing. Final drain is one 4.5-second budget including in-flight
work. Silence endpoints are engineering hypotheses, not mic-qualified VAD.

Queue: 32 seconds / 256,000 PCMU bytes plus one at-most-128,000-byte snapshot.
Worker request capacity: 30 seconds / 240,000 bytes, with derived base64 framing.
Worker response: 64 KiB, 512 timed words, 16,000 text characters. Final transcript:
160,000 characters / 24,000 words. Wall/audio ceiling: 60 minutes. All overflow,
crash/OOM, alignment and timeout failures insert no successful truncated prefix.
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

- 33 Node and 12 Python deterministic tests pass, including maximum worker framing,
  independent audio/time ceilings at 60 minutes, serial overlap/tail draining,
  queue overload, pre-ready frames, cancellation, timeout, OOM/crash, disposal,
  invalid word timestamps, repeated-word seams, silence endpoints, and edit scoring.
- Three tests through the unmodified stock composer pass: reproduce stale partial
  insertion, retain the asynchronous final tail, and insert no prefix on overload.
- Actual host relay/manifest/SDK contract smoke passes. Source was read-only.
- Published SDK remains an exact locked development dependency; no stub or vendored
  declaration. Public CI of this new chunked milestone is pending review/push.
- A 20-second synthetic replay through stock capture encoding/controller, actual
  relay, and real GPU worker passed exact audio hashes and editable late insertion
  with no chat-send RPC. Five-minute results will be appended after execution.

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

## Remaining acceptance limits

No real browser/network/microphone or Swiss-German acceptance, no hour-long soak,
no production deployment, and no claim that 30/60-minute stock-browser recording
works. The in-process composer harness simulates microphone input and RPC transport;
it exercises stock UI/relay code but cannot test device/browser/network behavior.
The browser itself has a 10-second pre-creation buffer and no bounded post-creation
RPC queue. These host-owned behaviors are outside a provider-only implementation.
