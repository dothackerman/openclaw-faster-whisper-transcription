# Local Faster-Whisper dictation for OpenClaw

Development preview. Native external plugin for the existing browser dictation
composer, targeting OpenClaw **2026.9.6**. One dedicated Python/CTranslate2 process,
multilingual `medium`, automatic language detection, local GPU inference. Partial
text is replaced while speaking; Stop produces one editable final. The stock
composer sends nothing automatically.

Implementation and evaluation are in progress. See [architecture](docs/PLAN.md)
and [research](research/). No quality or latency claim is established yet.
