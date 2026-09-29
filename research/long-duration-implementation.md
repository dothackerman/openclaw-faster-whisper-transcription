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
