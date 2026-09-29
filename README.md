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
resampled once to 16 kHz. This cannot restore the bandwidth lost at capture;
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

The plugin has a **60-minute wall/audio safety ceiling**. However, stock OpenClaw
2026.9.6 expires transcription sessions after **30 minutes**; this plugin cannot
extend that host limit. Neither 30 nor 60 minutes is qualified recording support.
See [long-duration design and host limitations](docs/LONG-DURATION-PLAN.md) and
[measured long-duration results](research/LONG-DURATION-RESULTS.md). Synthetic
replay cannot qualify real microphones or Swiss German.

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
development dependency fixes the locally reproduced failure; the updated public
workflow awaits Kappa's review and push. See [SDK development](docs/SDK-DEVELOPMENT.md).

## Evaluate

See [measured results and rejected candidates](research/RESULTS.md),
[experiment protocol](research/experiment-design.md) and the measured [duration decision](docs/DURATION-DECISION.md). Fixed public fixtures are synthetic eSpeak NG audio generated from
self-authored scripts; their hashes are in `fixtures/public/manifest.json`. They
prove transport/benchmark reproducibility, not real microphone or dialect quality.

```sh
node scripts/experiment.mjs /absolute/local/profile.json fixtures/public/manifest.json .local/run.json 3
.venv/bin/python scripts/score.py .local/run.json
node scripts/duration-screen.mjs /absolute/local/profile.json .local/duration.json
```

A profile contains the plugin config, including dedicated absolute runtime/model
paths. The provider harness replays 100 ms frames in real time, logs latency and
GPU samples, and writes detailed output **locally**. Scoring reports micro WER/CER,
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
