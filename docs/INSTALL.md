# Install, reload, and rollback

This is a development release candidate, not yet accepted on real microphones.
No production installation or config change was performed during development.
The package targets OpenClaw 2026.9.6; newer versions require contract validation.
Read [stock composer limitations](STOCK-COMPOSER.md) before installing.

## Provision a separate runtime

Linux x86-64, Node 24, Python 3.12, and a working NVIDIA driver are the tested
platform. GPU dependencies bring their own CUDA 12/cuDNN 9 userspace libraries.
No system CUDA toolkit or another project's Python environment is required.
GPU is the default; CPU use requires explicit `device: "cpu"` and a supported
`computeType`, and must be measured against the same final deadline.

From an extracted, reviewed release artifact:

```sh
python3 scripts/bootstrap.py --root /absolute/dedicated/fw-runtime-rc1 --gpu
```

The command refuses an existing directory, creates its own venv, installs exact
locked versions, and records the resolved environment. It needs network access
and may download large wheels. It never runs automatically during Gateway
startup, plugin registration, reload, or npm install. Runtime directories should
be writable only by the operator. Use different roots for development and production.

Provision the model explicitly with that dedicated Python. This example pins the
multilingual medium snapshot used in development:

```sh
/absolute/dedicated/fw-runtime-rc1/venv/bin/python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="Systran/faster-whisper-medium",
    revision="08e178d48790749d25932bbc082711ddcfdfbc4f",
    local_dir="/absolute/dedicated/fw-runtime-rc1/model",
    allow_patterns=["config.json", "model.bin", "tokenizer.json", "vocabulary.txt"],
)
PY
```

Retain the model revision and `sha256sum` of model files with the release record.
A verified copy of those immutable files is also supported. Runtime inference is
local-only and refuses missing files instead of downloading. `model` is a catalog
label; `modelPath` selects the actual files. Keep them consistent when changing
models, and remeasure quality, VRAM, and drain latency.

## Install an immutable artifact

First review its exact source commit, package file list, and SHA-256 digest. Keep
the previous artifact, runtime root, provider selection, and plugin config for
rollback. Do not point a production Gateway at a mutable checkout or use `-l`.

The following commands are operator actions, not development smoke tests. Select
the intended OpenClaw home through the deployment's normal environment. With a
running Gateway, installation and configuration can apply immediately; no routine
restart is needed. Review the native source/capability consent prompts.

```sh
openclaw plugins install npm-pack:/absolute/releases/openclaw-faster-whisper-transcription-0.1.0-rc.2.tgz
openclaw config set plugins.entries.faster-whisper-transcription.config '{"python":"/absolute/dedicated/fw-runtime-rc1/venv/bin/python","modelPath":"/absolute/dedicated/fw-runtime-rc1/model"}' --strict-json
openclaw config validate
openclaw plugins enable faster-whisper-transcription
openclaw config set agents.defaults.voiceModel '"faster-whisper/medium"' --strict-json
```

When required configuration is absent, the installer should retain the package
disabled until configured. Do not assume `talk.transcription.*` exists. The actual
host loader/selection smoke verifies `agents.defaults.voiceModel` works without
enabling telephony or adding a `voice-call` entry. Existing explicit
`voice-call.config.streaming.provider` takes precedence; inspect your own authored
settings and deliberately resolve conflicts. This plugin does not edit them.

After a reviewed package replacement or source repair:

```sh
openclaw plugins reload faster-whisper-transcription --json
openclaw plugins inspect faster-whisper-transcription --runtime --json
```

Normal plugin-config changes replace the instance in the host's hybrid reload
mode. `api.lifecycle.onDispose` and host cleanup stop the exact owned child and
await exit, including SIGKILL escalation after 500 ms. CUDA lives in that separate
process, not in the Gateway. Check the reload receipt and cleanup warnings. If
replacement is refused while work is retained, finish dictation and retry. Do not
restart the Gateway merely to update this plugin.

Verify `talk.catalog.transcription` advertises `faster-whisper` / `medium`. Test
English, German, mixed speech, silence, Stop, cancellation, and each real mic in
the stock browser. Expect activity metering but no live text. Confirm a complete,
editable final around five seconds after Stop and no automatic sending. Avoid
starting another dictation while waiting: the stock composer cancels a previous
pending insertion when a new session starts.

## Rollback / uninstall

Stop dictation. Restore the previous `agents.defaults.voiceModel` with `openclaw
config set` (or unset it if it was absent), then disable the plugin with `openclaw
plugins disable faster-whisper-transcription`. Keep the separate runtime/model
until rollback is verified. To return to an earlier plugin version, reinstall
its exact reviewed tarball, using the CLI's deliberate overwrite flow, restore
that version's plugin config, validate, enable, and reload as needed. Review
capability/source prompts rather than bypassing them blindly.

To remove it, use `openclaw plugins uninstall faster-whisper-transcription` and
review the CLI plan. Runtime/model files were explicitly provisioned outside the
package and remain operator-owned; remove only that dedicated root after verifying
no process uses it. Never delete shared caches or another Python environment.

## Troubleshooting

- Not configured: verify absolute Python/model paths and execute permissions;
  inspect the manifest/config validation result. Discovery does not load a model.
- Startup failure: run the dedicated Python import checks and verify local model
  files. The worker uses only its own CUDA libraries; no implicit CPU fallback.
- GPU OOM: the current session fails and the worker exits. Free VRAM or explicitly
  provision a smaller/quantized model. Start a new session; audio is not retried.
- Final timeout: do not raise the budget above 4.5 seconds. OpenClaw drops results
  after five. Inspect measured queue lag and GPU throughput before changing a profile. No
  speculative text is inserted as a successful final.
- Cannot keep up / alignment failure: the whole dictation fails explicitly. No
  partial is inserted as success. These are quality/throughput qualification failures.
- Ceiling: the plugin fails closed at 60 minutes; the stock host expires sessions
  at 30 minutes first. There is no provider-only renewal setting.
- Slow insertion after a quick decode: the stock late-final listener waits for
  relay close. This is separate from GPU inference latency.

## Migration from the short-dictation prototype

Remove `maxAudioSeconds` and `snapshotIntervalSeconds` from the reviewed plugin
configuration before replacing the instance. They are rejected by the new schema;
there is no automatic config migration or host write. Chunking is always enabled,
with bounded internal windows/queue independent of total recording duration.
Errors no longer finalize a truncated accepted prefix. Install/reload only when
separately approved for the target host; this development session performs neither.
