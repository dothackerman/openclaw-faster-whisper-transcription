# Architecture and implementation plan

Target: OpenClaw v2026.9.6, verified against prepared source commit
`d30287734dee7ab3d86b216777c11ea195a021b8` plus its local patch. Core is read-only.
All three research notes are inputs to verify, not implementation authority.

## Architecture

- Native external plugin `faster-whisper-transcription`, one realtime transcription
  provider `faster-whisper`. Built ESM, official SDK entry and provider types,
  inline manifest schema and declared capability. No UI/core changes.
- One instance-owned Python subprocess over bounded newline JSON pipes. No port,
  shared daemon, credential forwarding, or persistent audio/transcript storage.
  A dedicated, explicitly provisioned virtualenv and model directory are required.
  Runtime does not install packages or download models.
- One admitted dictation and one GPU decode at a time. Retain at most 30 seconds
  of mu-law audio. Re-decode cumulative snapshots every two audio seconds, coalesce
  previews while busy, and replace partial text. Emit exactly one final on stop.
  This small initial design deliberately rejects longer dictation instead of
  introducing unmeasured chunk-boundary stitching.
- Python decodes G.711 mu-law/8 kHz and polyphase-resamples once to float32/16 kHz.
  Multilingual medium, automatic language detection, unbatched CUDA float16,
  beam 5, upstream fallback, no VAD/prompt by default: baseline, not optimum.
- Lazy process/model load on connect before ready; process reuse while warm;
  terminate on idle to release native GPU allocations. Lifecycle disposal awaits
  owned-child exit. Crash/OOM/timeouts fail the session with fixed safe messages;
  no implicit CPU fallback or automatic retry of private audio.
- The actual relay drains for 5 seconds. Use a 4.5-second total stop budget,
  including any outstanding partial; fail visibly if a final cannot finish.
  Never represent partial text as a successful final. Stock UI may itself retain
  partial text on failure; document this existing behavior.
- Provider settings live in this plugin's config. Validate request model/options;
  use official Talk selection precedence. Verify voiceModel routing in isolation,
  because the stock browser supplies no provider override and legacy streaming
  settings are read from voice-call configuration.

## Coherent milestones

1. Plan, metadata, bounded supervisor/session, Python decoder, lifecycle ownership.
2. Deterministic failure/lifecycle/audio tests, exact SDK and relay contract proof,
   packaging and isolated runtime validation.
3. Dedicated Python bootstrap with pinned dependencies, reproducible experiment
   harness/scorer, fixed public synthetic fixtures and append-only decision ledger.
4. Installation/hot-reload/rollback/privacy docs, CI, final public-tree audit and
   local commits for Kappa review. No push until exact-tree approval.

## Evaluation gates

Correctness first: snapshot replacement; no lost final frames; repeated close;
backpressure; invalid config; concurrent connect; child crash/OOM; load timeout;
final deadline; disposal; silence; mu-law known vectors and sample counts.
Then fixed-fixture baseline/comparator runs with WER/CER, partial/final timings,
GPU telemetry, exact runtime/model/corpus hashes, and explicit keep/reject reasons.
Private fixtures/results stay outside tracked paths. Synthetic results cannot
establish microphone/dialect quality. Real browser/mic acceptance remains separate.

## Initial evidence / blockers

The contract and 5-second drain were personally verified in provider-types.ts,
transcription-relay.ts, session-config.ts, and composer-dictation.ts. The browser
replaces partials, accumulates finals, and inserts editable text without sending.
Hot replacement disposes plugin ownership; no routine Gateway restart is needed.
`nvidia-smi` currently cannot communicate with the driver in this execution
sandbox. GPU measurements require working device access; do not invent results.
