# Long dictation: preliminary measured results

Status: implementation/evaluation in progress, not release or microphone acceptance.
All speech here is self-authored, non-looped eSpeak NG synthesis transported as
8 kHz G.711 mu-law. The five-minute script has 218.332 seconds of synthesized
paragraph audio and padding to 300 seconds. Public manifests record every hash.
No private OG recordings, real microphone, or Swiss-German acceptance is claimed.

Initial screens are dirty-tree experiments with per-artifact hashes in the
append-only [ledger](experiments.jsonl). They are development evidence, not a
clean-release comparison. The same five 20-second fixtures were used throughout.

| Profile | Finals | Pooled WER / CER | Decision |
| --- | --- | --- | --- |
| Whole-utterance medium/float16/beam5 | 5/5 | 19.72% / 11.90% | Comparator only; mixed-language omissions |
| 8-second / 2-second overlap | 4/5 | Incomparable successful subset | Reject: German seam failure |
| 16-second / 4-second overlap | 5/5 | 19.01% / 11.12% | Retain for exploration, reject quality acceptance |

The 16/4 profile had 11 deletions in the mixed fixture and failed its final-five-word
check. German had seven substitutions and one insertion. English had one
substitution; the dedicated boundary fixture had zero lexical edits. The aggregate
one-error difference versus whole inference does not establish a quality gain.
Adjacent duplicate-insertion count was zero in this small screen; that is not a
proof against other boundary duplicates. Edit alignment has deterministic ties,
and the final-five check is exact normalized text, not a human semantic judgment.

All five 16/4 final callbacks arrived within 843 ms in this one screen, including
silence (3 ms). There are too few observations for a reliable p95. One separate
stock-composer/actual-relay/real-worker replay of the English clip inserted editable
text after 5017 ms; the provider final arrived after 836 ms. Input and relay audio
SHA-256 matched and only Talk RPC methods occurred. This validates the harness and
that specific path; it is not a real browser/network/microphone recording.

Next experiment: prefer a detected pause when available, with a 16-second forced
maximum and time-aware overlap alignment. Endpoint selection never drops audio;
quiet speech can still be split incorrectly and must be tested on real microphones.
The existing stock 30-minute relay TTL remains an independent obstacle to OG's
60-minute ceiling requirement. No core patch is made.

The pause-aware follow-up completed 5/5 finals, with zero aligned deletions on
these fixtures; the mixed final-five check still failed. Its decision is to proceed
to longer integration evaluation, not accept microphone quality. RMS-based pause
selection does not remove audio and can still split quiet syllables incorrectly.
The planned five-minute replay is an in-process stock-code integration with mocked
capture/RPC transport, not a real microphone recording.
