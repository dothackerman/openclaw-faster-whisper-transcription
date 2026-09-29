# Long-duration implementation evidence

Independent architect notes; do not replace incoming researcher files.

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
