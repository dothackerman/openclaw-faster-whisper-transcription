# Local Faster-Whisper dictation for OpenClaw

An external native plugin for OpenClaw **2026.9.6** browser dictation. It uses a
plugin-managed Python sidecar and local Faster-Whisper/CTranslate2 inference.
Default: multilingual **medium**, CUDA float16, automatic language detection.
German and English need no manual switch; Swiss German quality is unverified.

**Experimental prototype; not production-qualified.** No production install or real microphone
acceptance has been performed. MIT licensed. No core or UI patches.

**Live text preview is disabled to prevent lost words.** This stock composer
commits a partial immediately on Stop and ignores the later final. The plugin
therefore emits one final after Stop, which the existing UI inserts as editable
text without sending it. Stock insertion waits roughly five seconds, even when
inference is faster. See the [tested composer limitation](docs/STOCK-COMPOSER.md).

## Install

Follow [provisioning, immutable installation, hot reload, and rollback](docs/INSTALL.md).
The npm artifact contains the plugin and Python source, not a Python environment,
CUDA binaries, or model weights. Provision those explicitly into a dedicated root.
Registration and reload never download dependencies or models.

## Runtime bounds and privacy

One active dictation, one worker, one inference request in flight. No ports or
shared daemons. Audio is G.711 mu-law/8 kHz from the stock browser, decoded and
resampled to 16 kHz within each inference window. This cannot restore the bandwidth lost at capture;
model tuning is not a substitute for microphone/path evaluation.

Audio and transcripts stay in memory and private subprocess pipes, never ordinary
logs. Native stderr is drained without retention. Model loading is lazy on first
connect; the warm child exits after 120 idle seconds to release GPU memory.
Crashes, OOM, startup/decode timeouts, and finalization failures are visible.
There is no automatic CPU fallback or private-audio retry. Linux parent-death
signaling also terminates the worker if its Gateway parent exits unexpectedly.

Recording is processed continuously with pause-aware windows, a **16-second
maximum and 4-second overlap** at forced boundaries, not a short recording cap. A single serial decoder joins timed
words across overlaps. The rolling audio queue is limited to 32 seconds (256 KB),
plus one 16-second snapshot; completed recording audio is not retained. Final text
is bounded to 160,000 characters / 24,000 words. Queue overload, ambiguous seams,
ceiling or deadline failure return an error and **no successful truncated final**.
The total Stop drain remains **4.5 seconds**, including in-flight work.
Only the initial fresh prefix can anchor a splice; its full suffix remains fresh,
preserving recovered words. A wholly contained old-only word before that anchor
causes explicit failure if it ends at least 200 ms before the first fresh token.
Overlapping/nearby timestamps and left-clipped context may remain; this can also
retain spurious words and is not a calibrated confidence guarantee. A leading substitution
requires acoustic overlap and two following exact timed words, and retains the
old first spelling. The fresh suffix can still replace correct old words with
incorrect ones. This heuristic can reject ordinary speech and is not qualified
for complete dictation; timestamps do not prove that no speech was missed.

The plugin has a **60-minute wall/audio safety ceiling**. However, stock OpenClaw
2026.9.6 expires transcription sessions after **30 minutes**; this plugin cannot
extend that host limit. Neither 30 nor 60 minutes is qualified recording support.
On stock OpenClaw, stop well before expiry and start another recording manually;
this does not satisfy uninterrupted hour-long dictation. That requirement needs a
separately reviewed host change for a longer TTL, safe expiry drain and visible
auto-Stop. The proposed host guard is about 65 minutes: TTL starts at session
creation, so exactly 60 minutes leaves insufficient lifecycle/drain headroom.
This is an upstream proposal, not a plugin setting or a support claim.
The plugin cannot promise a recoverable final when the host expires its session.
**Loss risk:** the current plugin ceiling is an abort, not an automatic save.
If reached on a host with a longer lifetime, it clears the entire in-memory
dictation and inserts no text, including text already decoded. There is no recovery
file. This behavior does not satisfy loss-safe hour-long dictation; do not rely on
the 60-minute guard as a usable recording limit.
See [long-duration design and host limitations](docs/LONG-DURATION-PLAN.md) and
[measured long-duration results](research/LONG-DURATION-RESULTS.md). Synthetic
replay cannot qualify real microphones or Swiss German.

Worker replies are bounded separately: 16,000 text characters and 64 KiB of framed
stdout per decoded window. The complete transcript never traverses that worker
reply: TypeScript assembles it under the 160,000-character / 24,000-word bounds.
These limits fail explicitly; raising them alone cannot establish duration support.

Remove the obsolete `maxAudioSeconds` and `snapshotIntervalSeconds` keys when
upgrading; they now fail config validation. Window/queue sizes are internal tested
constants, not knobs that promise longer support merely by accepting more bytes.

| Setting           | Default   | Meaning                                                   |
| ----------------- | --------- | --------------------------------------------------------- |
| `python`          | required  | Absolute executable in the dedicated environment          |
| `modelPath`       | required  | Absolute provisioned local model directory                |
| `model`           | `medium`  | Catalog label matching those model files                  |
| `device`          | `cuda`    | Explicit `cuda` or `cpu`                                  |
| `computeType`     | `float16` | Also `int8_float16`, `int8`, `float32`; must be supported |
| `beamSize`        | 5         | 1–5; benchmark before changing                            |
| `idleSeconds`     | 120       | 1–3600 before child/model eviction                        |
| `loadTimeoutMs`   | 90000     | Cold startup budget, at most 120000                       |
| `decodeTimeoutMs` | 15000     | Individual chunk decode budget                            |
| `finalTimeoutMs`  | 4500      | Total final drain budget, at most 4500                    |

## Develop and verify

Use Node 24 and Python 3.12. `openclaw@2026.9.6` is an exact, locked development
dependency supplying the public `openclaw/plugin-sdk/*` exports. A clean install
needs no host checkout or SDK symlink:

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r python/requirements.lock
npm test
npm run format:check
npm run fixtures:check
npm run package:check
```

For CUDA experiments, use `python/requirements-gpu.lock` instead. Build output is
ignored; `npm pack` builds it and packages only an explicit file allowlist.

Source integration smokes import the **unmodified** host implementation in an
isolated process with temporary state. Set `OPENCLAW_SOURCE` to the exact checkout
and `TSX_TSCONFIG_PATH` to its `tsconfig.json`, then run each script with that
checkout's `tsx` loader:

```sh
node --import "$OPENCLAW_SOURCE/node_modules/tsx/dist/loader.mjs" scripts/contract-smoke.mjs
node --import "$OPENCLAW_SOURCE/node_modules/tsx/dist/loader.mjs" scripts/loader-smoke.mjs
node --import "$OPENCLAW_SOURCE/node_modules/tsx/dist/loader.mjs" scripts/composer-smoke.mjs
```

These cover native manifest/registration, model selection without telephony,
managed disposal, actual relay final drain, and stock composer insertion/no-send.
The GitHub workflow runs deterministic checks; these exact-source integration
smokes additionally require a prepared host checkout. The first public CI run
failed because an ad-hoc npm install omitted the optional host peer. The locked
development dependency fixed that failure; Kappa confirmed public CI passed for
rc1. **rc2 has not been pushed and has no public CI result yet.** Its deterministic
checks pass locally, but current GPU qualification fails (details below).
Kappa reviews before publication. See [SDK development](docs/SDK-DEVELOPMENT.md).

## Evaluate

See [long-duration results and decisions](research/LONG-DURATION-RESULTS.md),
[historical full-utterance results](research/RESULTS.md), and the
[experiment protocol](research/experiment-design.md). Fixed public fixtures are
synthetic eSpeak NG audio from self-authored scripts. Hashes are in
`fixtures/public/manifest.json` and `fixtures/public/long-manifest.json`.
They do not establish real microphone or dialect quality.

Current rc2 evidence: 5/5 rapid finals, with German/mixed recognition errors.
The five-minute fixture fails after 212.480 seconds of accepted audio. These
commands reproduce evaluation, not a claim of supported five-minute dictation.

After provisioning the dedicated runtime/model and a local profile, build and
validate fixture manifests, then run the five approximately 20-second fixtures
through the current chunked provider:

```sh
npm run build
npm run fixtures:check
node scripts/experiment.mjs /absolute/local/profile.json fixtures/public/rapid-manifest.json .local/rapid.json 1 chunked
.venv/bin/python scripts/score_long.py .local/rapid.json
```

For a matched short-fixture comparator, use the evaluation-only whole-utterance
decoder. It accepts at most 30 seconds and is not the production provider:

```sh
node scripts/experiment.mjs /absolute/local/profile.json fixtures/public/rapid-manifest.json .local/whole.json 1 whole
.venv/bin/python scripts/score_long.py .local/whole.json
```

For the five-minute in-process stock-composer/relay replay, export
`OPENCLAW_SOURCE` and `TSX_TSCONFIG_PATH` as for the source integration smokes:

```sh
node --import "$OPENCLAW_SOURCE/node_modules/tsx/dist/loader.mjs" scripts/experiment.mjs /absolute/local/profile.json fixtures/public/five-minute-manifest.json .local/five.json 1 composer
.venv/bin/python scripts/score_long.py .local/five.json
```

The `whole` comparator uses the same model without word timestamps or stitching.
The five-minute `composer` mode is paced source-level integration with simulated
DOM, microphone and RPC transport, real stock encoding/relay/controller and real
inference. It does not test a browser engine, listening Gateway or physical mic.
The old looping `duration-screen.mjs` deliberately throws and must not be used on
this revision. Its [duration report](docs/DURATION-DECISION.md) is archived evidence;
reproducing those old experiments requires their exact ledger commits.
`scripts/trace-windows.mjs PROFILE AUDIO OUTPUT` is an unpaced diagnostic only;
never report its timing as real-time latency. Output files refuse overwriting.

A profile contains the plugin config, including dedicated absolute runtime/model
paths. Provider mode replays 100 ms frames; composer mode uses stock-sized 4096-sample
frames with mocked capture/RPC transport and actual stock relay/controller code.
Both run in real time, record latency and
GPU samples, and write detailed output **locally**. Scoring reports micro WER/CER,
per-language results, silence hallucinations, and exploratory percentiles. Its
NFC/lowercase normalization preserves `ß` versus `ss`; punctuation is removed.
First-partial latency is intentionally absent in final-only mode. Provider-final
latency is not browser insertion latency. Five-second telemetry baselines are
screening only; acceptance requires longer matched idle baselines and at least
20 warm repetitions as described in the research protocol.

Keep private recordings outside the worktree. `.local/`, `.runtime/`, private
paths, environments, and ordinary audio extensions are ignored. Inspect every
public result: no raw audio or private transcripts should enter a PR or package.
See [contributing](CONTRIBUTING.md) and [security](SECURITY.md).
