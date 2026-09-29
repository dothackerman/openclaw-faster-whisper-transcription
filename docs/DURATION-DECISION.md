# Historical full-utterance duration screen (superseded design)

OG has now chosen continuous dictation without a short recording cap. This
historical screen explains why the full-utterance design was replaced with
[bounded internal chunking](LONG-DURATION-PLAN.md). Bounds and settings below
refer to commit 05004a1, not the current schema. Original measured failures remain
valid evidence against full-utterance decoding at Stop.

## Technical capacity regression check

The schema/runtime ceiling is experimental transport capacity, not a duration
recommendation. At that ceiling, 120 × 8000 = **960,000 mu-law bytes** become
**1,280,027 bytes** in the Node JSON decode line, including its newline. Both
workers bound framing at **1,284,096 bytes** (base64 capacity plus 4096 bytes for
JSON overhead); Python independently rejects audio beyond 960,000 bytes. Node
rejects oversized audio before base64 encoding. The earlier 330,000-byte frame
and 240,000-byte audio limits are no longer present.

`tests/bounds.test.mjs` sends the full maximum through the production provider,
Node subprocess transport, and Python request parser/base64 validation, checking
the final byte count and SHA-256. It also tests a frame crossing the cap by one
byte. `tests/test_worker_protocol.py` independently tests Python's exact maximum,
one-byte overflow before audio decoding, and oversized framing. The inference
backend is substituted in these tests: they prove transport acceptance and bounds,
**not decoding quality, GPU latency, or 120-second dictation support**.

## Measured counterexample

Medium CUDA float16, full-utterance final decode, automatic language detection,
Faster-Whisper 1.2.1 / CTranslate2 4.8.0, 4.5-second final budget. Each fixture is a
repeated synthetic eSpeak technical sentence. The nominal lengths are targets;
only whole clip copies were used, giving these actual lengths:

| Target | English actual | German actual | Beam 5 completion | Beam 1 completion |
| ------ | -------------- | ------------- | ----------------- | ----------------- |
| 15 s   | 14.7195 s      | 14.8385 s     | EN 3/3, DE 3/3    | EN 3/3, DE 3/3    |
| 30 s   | 29.439 s       | 29.677 s      | EN 0/3, DE 3/3    | EN 0/3, DE 3/3    |
| 60 s   | 58.878 s       | 59.354 s      | EN 0/3, DE 3/3    | EN 0/3, DE 3/3    |
| 120 s  | 117.756 s      | 118.708 s     | EN 0/3, DE 3/3    | EN 0/3, DE 3/3    |

Both profiles completed **15/24** callbacks and timed out **9/24**. English at
30/60/120-second targets failed 3/3 at each length, around the 4500 ms deadline.
Beam 5 near-15-second final callbacks took 946–1527 ms (EN) and 951–1190 ms (DE).
Beam 1 did not fix the deadline failures. Do not interpret German completions as
quality passes: longer German loops returned implausibly short output (117
characters at the 30-second target, versus 237 at 15 seconds). This screen recorded
character counts, not exact output/reference scoring, so omission is a concern,
not a quantified WER finding.

These synthetic loops stress repeated speech and fallback behavior. They are not
representative quality data or evidence about a particular microphone or dialect.
The screen does not identify the cause of every timeout; temperature fallback or
repetition is a hypothesis requiring instrumentation, not a measured explanation.
The beam-1 screen ran with a dirty tree, so its provenance is weaker and it cannot
select a release profile. Neither profile justifies claiming long-dictation support.

## Original decision before OG selected continuous dictation

- If short utterances with a visible cap are acceptable, retain final-only decoding
  and qualify the chosen cap on real English/German microphone recordings. The
  current automatic-cap path preserves accepted text before showing its notice.
- If uninterrupted 30 seconds or more is required reliably on this GPU/model,
  **chunked internal inference is the next architecture to implement and measure**.
  Raising a buffer limit or lowering the beam is insufficient based on this screen.
  Raising the final deadline cannot help: OpenClaw removes the relay at five seconds.
- Live text preview is a separate upstream limitation. Chunking cannot make the
  current stock controller safely replace an already committed partial at Stop.

A chunked design would decode bounded windows during capture, commit stable text
**internally only**, retain a short overlapping audio tail, and decode only that
tail on Stop. It needs one serial inference lane, bounded unprocessed audio and
text, and explicit overload failure. Prefer silence endpoints with a maximum
window; forced boundaries need measured overlap/alignment and deduplication.
Timestamps or local agreement cost extra work but may be necessary to avoid
missing or doubled words. Do not simply concatenate independently cut clips.

Qualification must compare against the same full-utterance baseline on fixed,
non-looped scripts and consented local mic recordings, including words spanning
boundaries, names, numbers, code-switching, pauses, and continuous speech. Measure
WER/CER, deletions/duplications, queue lag, GPU memory/load, end-tail correctness,
and Stop-to-provider-final latency. Reject a faster chunker that loses meaning.
Final-only output and the five-second stock insertion wait remain unchanged.

The current tree implements the chunking branch; see the long-duration plan and
results for its separate qualification status.
