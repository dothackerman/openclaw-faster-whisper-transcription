# Long-duration implementation evidence

Independent architect notes; do not replace incoming researcher files.

## Fresh-prefix deletion correction

Independent QA found that a late overlap anchor could discard a real word that
only the fresh hypothesis recovered. Executing the pre-fix implementation from
`0050c30` on old "Do send this" and fresh "Do not send this message" confirms a
successful merged "Do send this message". Matching later words does not justify
deleting the negation. The `94bda99` fix requires the selected contiguous,
time-consistent match to cover every fresh word through the splice anchor.
Otherwise reconciliation throws; the provider clears the session and emits only
an error. Adversarial tests cover an interior recovered negation, an unmatched
leading word, and the provider's no-final behavior. Existing repetition and
hallucinated-tail tests remain passing. This is a conservative failure policy,
not proof that the recognizer heard every spoken word or that failures preserve
the user's dictation. Failing the session loses its text as documented.

The exact additional reviewer repro is now checked: old `alpha@5, anchor@7`;
fresh `alpha@5, recovered@5.5, anchor@7, tail@8`. Tests use 300-ms word spans
and a fresh window beginning at 4 seconds, converting its timestamps to relative
1/1.5/3/4 seconds. Running the pre-fix `0050c30` implementation confirms the
successful but incorrect `alpha anchor tail`. The guarded version throws.
Single-word run ties can still select the later anchor, but the separate prefix
proof rejects it because run length 1 cannot account for three discarded fresh
words. Additional tests reject silent reversion of a corrected word before a
later single common token and a two-token `in the` sequence. All 42 Node and
13 Python tests pass; runtime code did not change for these additional tests.
This resolves the precise silent-deletion repro, not overall seam reliability:
the previously recorded rapid German and five-minute failures still apply.

### Symmetric retained-prefix follow-up

The exact symmetric interior case (old `alpha@5, old-only@5.5, anchor@7`, fresh
`alpha@5, anchor@7, tail@8`) already fails the fresh-prefix guard because its
matching run is broken. A further case exposed a remaining gap: old
`old-only@4.5, alpha@5, anchor@7` versus the same fresh hypothesis succeeded under
`8fa9dcc`, retaining an unconfirmed old word before the first fresh match. This
was independently executed against that revision, not inferred from code alone.

`73aaec5` additionally requires every retained old word whose end is after the
fresh window start, through the chosen anchor, to belong to that same contiguous
token/time matching run. Together the checks form a conservative monotone
one-to-one prefix alignment with no unmatched words on either side. Old words
ending before the fresh audio window are outside that comparison. This does not
choose an earlier tie as a workaround. Three new tests cover the symmetric
interior conflict, old-only leading overlap, and valid earlier context; the exact
fresh-word, corrected-tail and genuine repetition regressions still pass.
All 45 Node and 13 Python tests pass. The stricter policy can reject more sessions;
the new clean paced results must be used for its qualification.

The additional exact symmetric repro is now a regression too: old `phantom@6,
anchor@7`, fresh `anchor@7, tail@8` with window start 6 seconds. The 300-ms
phantom span ends at 6.3, so it is inside fresh time coverage, not exempt earlier
context. `firstOldInWindow = 0` precedes `matchedOldStart = 1`, and the guarded
merge throws without a successful final. All 46 Node and 13 Python tests pass,
including genuine repetition and corrected-tail cases. No production code change
was needed for this additional exact test.

The final paced post-production-change run is `long-symmetric-five` at clean
`73aaec5`: failure after 32.768 seconds accepted, not five-minute acceptance.
After adding the exact phantom regression, every recorded runtime/harness source
hash and the Python worker hash was compared with the current files and matched.
In particular, `src/stitch.ts` is SHA-256
`fff4fb6fc30f83bb2e3d4e1c35ec87ee4890998949a3f1f0fc374d7288ab2dd8`.
Thus that paced rerun exercises the current production seam code, rather than
the older `9d27248` profile. Rapid German/boundary failures remain documented;
the conservative guard is not represented as usable long-dictation reliability.

An offline replay of the saved 34-window five-minute trace first rejects window
5 (43.16–48.18 seconds): a changed token before a later matching sequence no
longer gets silently discarded. This is diagnostic evidence only; paced reruns
and acceptance decisions are recorded separately in the append-only ledger.

## Exact-source TTL and transcript-bound recheck

Rechecked for Kappa on 2026-09-29 against the same prepared source commit.
`transcription-relay.ts:34` sets 30 minutes; creation fixes `expiresAtMs` and
installs a deadline timer. Both append and Stop call `getTranscriptionSession`,
which delegates to `requireActiveTalkRelaySession` in `relay-session-lifecycle.ts`.
The helper's expiry comparison is strictly `now > expiresAtMs`; the independent
timer closes at the deadline. Neither audio nor Stop extends the lifetime.
Expiry closes/removes the relay without retaining it for the ordinary Stop drain,
so a late provider final cannot repair this. A plugin-only hour-long claim is false.

The current worker is window-local: Python emits at most 16,000 text characters
per decode; Node independently bounds each reply to 64 KiB including JSON and
timestamped words. These are independent limits (JSON escaping/metadata can reach
the byte bound first), not a guarantee that every 16,000-character reply fits.
Production windows are at most 16 seconds. TypeScript accumulates the session's
words, up to 160,000 characters / 24,000 words, and sends the final directly through
the provider callback, never through worker stdout. A deterministic provider test
joins 20 window results into exactly 18,019 characters. This verifies aggregation,
not ASR quality, a real long-duration decode, or host/browser message acceptance.

### Ceiling recovery and paced-test audit

`src/realtime-transcription/provider-types.ts:21–40` has transcript/error/speech
callbacks, but no provider-initiated successful capture-stop acknowledgement.
`transcription-relay.ts:315–355` forwards a final without closing capture, whereas
an error removes the relay. `composer-dictation.ts:628–636` preserves an existing
snapshot on an error by stopping with `commit: true`. Final-then-error therefore
offers a possible interrupted-text recovery experiment, but does not establish
an atomic last-accepted-audio boundary during the asynchronous drain. No such
sequence is implemented or claimed safe. Current plugin `fail()` clears every
assembled word and buffered byte; its 60-minute ceiling is explicitly unsuitable
as a loss-safe user limit. Host expiry needs separately scoped changes, including
safe drain semantics, rather than only a longer TTL constant.

The corrected five-minute artifact (`long-five-aligned`, clean `9d27248`) records
row start 14735.944015 ms, ready delay 3464.084849 ms, row end 323209.202594 ms,
and Stop-to-result 5008.717413 ms. Subtracting ready and final time gives
300000.456317 ms of paced audio delivery (about 300.00046 seconds). The full run
was 315615.663096 ms including setup/baseline/teardown. `experiment.mjs` paces by
absolute cumulative PCMU duration at 8000 bytes/s using 4096-byte blocks; each
block precedes its wait, permitting up to 512 ms burst lead. This is real-time
source-level integration with simulated DOM/audio device/RPC transport, actual
stock encoding/controller/relay, and actual local Python/GPU inference. It does
not test a browser engine, listening Gateway, network, or physical microphone.

## Primary-source checks

- Prepared OpenClaw `src/gateway/talk/transcription-relay.ts`, source commit
  d30287734dee7ab3d86b216777c11ea195a021b8: session TTL is fixed at 30 minutes
  (lines 34, 265, 364–370). `sendTalkTranscriptionRelayAudio` does not renew it.
  This is a host-level obstacle to a full 60-minute browser session. No core
  modification is authorized or made; escalate that deviation to Kappa before work.
- Same relay retains the stopped provider for five seconds. Stock
  `ui/src/pages/chat/composer-dictation.ts:659–700` commits nonempty snapshots before
  waiting for final. Keep all chunk text internal and publish exactly one final.
- [Pinned Faster-Whisper 1.2.1 implementation](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/faster_whisper/transcribe.py)
  exposes word start/end/text via `word_timestamps=True`. Those timestamps are
  estimates, not proof of accurate word boundaries. Its default temperature list
  can perform repeated fallback decodes; windowing alone does not bound decode time.
- [Whisper-Streaming paper](https://arxiv.org/abs/2307.14743) describes agreement over
  successive hypotheses and bounded-buffer strategies. Our short overlapping-window
  seam algorithm is a separate implementation, not a reproduction of its quality
  or latency results. It must be measured on our transport and fixtures.

## Initial implementation choices to test

Eight-second inference windows, two-second overlap, one serial decoder. Timed
word/token agreement joins overlapping hypotheses, retaining the previous prefix
and replacing its short tail. No textual common-prefix alone across the entire
recording. Ambiguous overlapping hypotheses fail explicitly instead of guessing a
successful complete result. Bound pending audio to 24 seconds (including overlap),
per-request audio separately, final text separately, and session wall/audio time
at 60 minutes. These are memory/overload controls, not supported-duration claims.
Automatic language detection occurs per window, allowing language changes but
also risking wrong-language choices on short or synthetic speech. Evaluate this.

## Verified follow-up

Read the incoming `long-duration-host-contract.md`, `long-duration-quality.md`,
and `host-ttl-change.md` without modifying them. Their source-level constraints
match the active checkout. `scripts/ttl-smoke.mjs` executes the unmodified relay
with a fake clock: audio is accepted just before 30 minutes; expiry closes the
provider, labels the relay completed, rejects later appends, and ignores a late
final. This verifies the host obstacle without a live Gateway or core patch.

The 8/2 candidate failed a synthetic German seam after the first window returned
English text. A 12-second diagnostic window also returned English. A 16-second window
recognized German in that case, motivating the measured 16/4 candidate. No claim
is made that longer context always solves language selection. Pause-aware endpoint
selection subsequently reduced omissions on the mixed development fixture; it
uses 20 ms decoded-PCMU RMS, threshold 0.005, 600 ms quiet after activity, and a
four-second minimum. It does not filter or discard audio. Pause overlaps are
500 ms; forced 16-second boundaries retain four seconds. This is a separately
measured heuristic, not Silero VAD or a reproduction of Whisper-Streaming.

Host cancellation and normal Stop both call provider `close()` with no reason.
The plugin cannot distinguish them; it drains briefly under its existing deadline.
The removed relay/browser accumulator suppresses cancelled-session insertion.
Plugin disposal/reload is distinct and immediately fails the owner and stops its
worker. These boundaries are tested without production state.

## Microphone-path limits and test scope

The stock composer requests `AudioContext({sampleRate: 8000})` and refuses a
context whose actual sample rate differs (`composer-dictation.ts:150–159`). Its
input pump requests 4096-sample blocks (`talk/audio.ts:75–96`); the paced composer
harness now uses that block size, while provider-only rapid screens use 800-byte
frames. The in-process harness decodes synthetic PCMU to floats and executes stock
encoding; exact fixture/provider hashes prove this round trip for these samples.
It does not measure the browser/device resampler, acoustic echo cancellation,
noise suppression, gain control, clipping, room noise, or permission/device changes.

The 8 kHz signal cannot carry original frequencies above 4 kHz. Conversion to the
model's 16 kHz input does not reconstruct those missing frequencies. The independent
mu-law codeword and tone tests validate conversion, not microphone quality. The
new fixtures were synthesized at 22050 Hz and resampled to 8 kHz before companding;
this is a controlled transport input, not a recording of OG's laptop. Standard
German synthetic substitutions and code-switch errors require separate real-mic
and Swiss-German evaluation; neither passing callbacks nor a lower synthetic WER
resolves those questions.

## Alignment correction after the first five-minute replay

Offline traces showed a model-generated repeated suffix in one window followed
by a corrected hypothesis in the next. The original latest-token rule anchored
on a later common article and retained six unwanted words. Contiguous token-run
agreement, with the same timestamp tolerance, removes that failure in a fixed
regression and recorded-hypothesis reassembly. Time tolerance and tie-breaking
remain heuristics; this is not proof against every repeated-name/boundary case.
The missing German sentence was absent from the window hypothesis before assembly,
so fixing alignment cannot recover it. No decoder setting was changed to conceal
that failure. The second paced five-minute run tests the actual corrected pipeline.
