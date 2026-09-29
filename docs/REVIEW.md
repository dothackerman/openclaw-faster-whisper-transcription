# Kappa review handoff

Status: experimental prototype, not production-qualified. No push or production
mutation. The user's uninterrupted-duration requirement remains pending; the
[duration decision](DURATION-DECISION.md) explains when internal chunking is needed.
All three incoming research notes were read and checked against primary source.
The [research correction](../research/openclaw-plugin-contract.md#implementation-verification-correction-p1-review)
records the initially missed stock Stop behavior and verified selection route.

## Implemented

Native manifest/SDK provider; isolated explicit Python provisioning; local medium
model; correct mu-law/8 kHz decoding and 16 kHz resampling; automatic language
selection; one session/inference lane; bounded audio, request/response sizes and
wall time; final drain; pre-ready frame buffering; lazy load and idle process
exit; OOM/crash/timeout classification; managed disposal and host cleanup;
Linux parent-death termination; packaging allowlist; docs and CI definition.

P1 is corrected with **final-only callbacks**. The stock UI has no contract-safe
preview-only path and commits any nonempty partial before awaiting the final.
No early text callback is shipped, even when experimental internal snapshots are
enabled. The stock late-final path still waits about five seconds for relay close.
A duration cap finalizes accepted audio before reporting a visible limit notice.

## Exact checks performed

- `npm test`: **19 Node tests pass** (about 0.4 s) and **7 Python tests pass**
  (about 0.9 s), plus strict TypeScript compilation. Tests cover final-tail bytes,
  coalescing internal snapshots, repeated close, concurrent admission, duration cap,
  final timeout, warm reuse/idle eviction, disposal, crash/OOM, cancelled connect,
  model/config validation, cold pre-ready audio/Stop, cold drain deadline,
  real subprocess IPC/backpressure/oversized response/load timeout/missing executable,
  all 256 mu-law codewords against an independent decoder, silence/sample count,
  a 1 kHz tone, scorer normalization/edit distance, and safe Python error responses.
- `scripts/composer-smoke.mjs`: **3 tests pass using unmodified stock controller and
  session code** with mocked microphone/RPC. Reproduces pre-P1 stale partial insertion;
  proves full late-tail insertion/no send after the fix; proves accepted-prefix
  insertion on the duration-limit error-stop path.
- `scripts/contract-smoke.mjs`: actual host manifest parsing and SDK entry;
  actual relay create/append/Stop/final; pre-ready frames and Stop during cold load.
- `scripts/loader-smoke.mjs`: actual native loader, `talk.catalog` provider/model,
  `agents.defaults.voiceModel` selection without a voice-call entry, and managed
  instance disposal with no cleanup failures. Also passed against an extracted npm
  tarball, not only the source checkout. This is not a live Gateway reload RPC test.
- `npm run format:check`, `git diff --check`, and package allowlist check pass.
  The tarball excludes Python bytecode, fixtures/audio, research, node_modules,
  virtualenvs, models, and local result directories.
- Actual isolated GPU idle test: the owned process exited; host memory returned
  from 2587 MiB loaded to its 551 MiB initial level.

## Exact experiment failures and decisions

[Full sanitized ledger and results](../research/RESULTS.md).

- Duration baseline and beam 1: **15/24 callback completions, 9/24 timeouts each**.
  English 30/60/120-second targets failed **3/3 at each length** around 4500 ms.
  Near-15-second EN/DE targets completed 3/3 each. German longer-loop output lengths
  raise omission concerns; completion is not quality acceptance. Synthetic repeated
  speech is a stress test. Beam-1 duration provenance includes a dirty-tree flag.
- Fixed short corpus: **18/18 finals for each profile**; baseline WER **37.14%**,
  CER **16.28%**, versus beam-1 WER **38.10%**, CER **16.37%**. Baseline short-German
  WER **122.2%** and mixed WER **54.5%** are unacceptable synthetic quality results.
  Beam 1 worsens mixed WER to **72.7%** and is rejected. No quality gain is claimed.
- Baseline warm provider-final median **520 ms**, exploratory p95 **1765 ms**;
  candidate **495/1874 ms**. Only 17 warm observations, including silence, per
  profile. These are neither robust tail estimates nor browser insertion latency.
- Two interrupted experiments are retained as inconclusive, not silently counted
  as successful runs. Checkpointed completed comparisons used clean source `4af8dec`.

## Public-data boundary

Public audio consists only of six generated eSpeak NG fixtures from self-authored
scripts, each checked against the manifest SHA-256. No OG recordings or private transcripts were used. No live config, credentials,
environment contents, or model weights are tracked or included in the artifact. Detailed local runs and the
runtime/model copy remain under ignored `.local/`, `.venv/`, and `.runtime/`.
Tracked textual content and synthetic provenance were inspected, and secret-pattern
checks found no matches. The public ledger contains aggregate measurements and
opaque artifact hashes, not transcript text or private absolute paths.

The project code is MIT licensed. Upstream [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/LICENSE)
and the [medium model card](https://huggingface.co/Systran/faster-whisper-medium)
also identify MIT licensing. CUDA/cuDNN and other dependencies retain their own
licenses and are provisioned separately, never bundled here.

## Host source fingerprint

Prepared OpenClaw source commit `d30287734dee7ab3d86b216777c11ea195a021b8`;
source checkout was read-only and remained clean. SHA-256:

| File                                           | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `src/realtime-transcription/provider-types.ts` | `b1bc5adb93016fb966d99218883d1bbb4948924814052cc1eb1978d2c1a6a1be` |
| `src/gateway/talk/transcription-relay.ts`      | `46d00d577c24e6c1f45f7adf2bd00bebb7466600b034c3b0b96f4b1599307c4d` |
| `src/gateway/talk/session-config.ts`           | `5f192d557b4f9755f6afb2af19796572b5777d03817357bcffbb4f81a89fa361` |
| `ui/src/pages/chat/composer-dictation.ts`      | `b149c4f552bf0bc7660bdf9d9e4b89f94595943fd02afbff040c2a56b0deef5e` |

## Unrun / pending

Real browser/microphone acceptance, private/held-out quality, reliable longer
uninterrupted duration, full hot-reload RPC in an isolated running Gateway, public
CI execution, publication, and any production installation. Kappa must review the
exact final tree and evidence before pushing. No installation, live config edit,
Gateway restart, or production credential use was performed.
