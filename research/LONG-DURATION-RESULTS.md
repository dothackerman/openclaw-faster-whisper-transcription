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

## Clean paired rapid check and first five-minute run

At clean commit `139344a`, the same five rapid fixtures yielded 5/5 finals for both
whole inference and pause-aware chunking. Whole: 28/142 word edits (19.72% WER),
107/899 character edits (11.90% CER). Chunked: 14/142 (9.86%), 29/899 (3.23%).
The chunked mixed clip still has five substitutions and fails its final-five check;
German has seven substitutions and one insertion. No aligned deletions occurred
in this rapid chunked set. These are measured improvements on this small synthetic
development corpus, not evidence of general, real-mic, or Swiss-German gains.
Only four warm latency observations per mode, including silence: whole median
1100 ms, maximum 2239 ms; chunked median 522 ms, maximum 663 ms. The first German
chunked callback took 948 ms. Order was baseline then candidate, not a randomized
crossover, and power/thermal/background load were not controlled.

The first five-minute run used clean `e63aac6`. All 2,400,000 PCMU bytes reached
the provider unchanged through stock encoding/controller/relay. It completed
34 windows, peaked at 17.512 seconds queued (the 32-second bound includes context),
and took 573 ms Stop-to-provider-final / 5007 ms Stop-to-composer commit. GPU memory
was 551 MiB baseline, 2829 MiB peak, and 551 MiB after disposal; sampled mean GPU
utilization was 18.43%, peak 100%. This is host-wide sampling, not per-process
attribution. Unprocessed audio coverage peaked at 17.408 seconds; that metric
includes window lookahead and is not extra inference backlog.

Quality **failed complete-transcript acceptance**: 42/611 word edits (6.87% WER),
127/3819 character edits (3.33% CER): 27 substitutions, eight deletions, seven
insertions. Six inserted words repeat an earlier phrase. Exact final five words
match, but the final-20-word edit count is 11: a suffix match alone is insufficient.
The German sentence beginning “Im Nebenraum” was omitted in the model hypothesis.

An offline window trace separated model and stitcher errors. The model generated
a repeated phrase near the last boundary, and the old latest-token anchor wrongly
retained part of it despite a corrected next hypothesis. The stitcher now prefers
a contiguous time-consistent token run; a deterministic regression covers that
failure. Reassembling the recorded window hypotheses removes the repeated tail
and yields zero last-20-word edits; this is an offline diagnostic, not a new paced
latency run. A corrected five-minute replay is required before accepting the fix's
whole-path result. The first debug feeder attempt hit backpressure because it did
not await an automatically scheduled job; it is recorded as inconclusive.
