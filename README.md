# Local Faster-Whisper dictation for OpenClaw

Development preview. Native external plugin for the existing browser dictation
composer, targeting OpenClaw **2026.9.6**. One dedicated Python/CTranslate2 process,
multilingual `medium`, automatic language detection, local GPU inference. Stop produces one editable final. The stock composer sends nothing automatically.
**Live text preview is disabled**: this host commits partial text immediately on
Stop and can lose the final tail. See [the verified UI limitation](docs/STOCK-COMPOSER.md).
Stock final insertion takes approximately five seconds after Stop, even when
inference finishes earlier.

Implementation and evaluation are in progress. See [architecture](docs/PLAN.md)
and [research](research/). No quality or latency claim is established yet.
