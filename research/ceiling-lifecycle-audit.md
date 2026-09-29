# Plugin ceiling lifecycle audit

This audit uses the locally active OpenClaw 2026.9.6 source checkout at
[`d30287734dee7ab3d86b216777c11ea195a021b8`](https://github.com/openclaw/openclaw/tree/d30287734dee7ab3d86b216777c11ea195a021b8).
No Gateway configuration, installation, restart, or core/UI modification is made.

## Exact current plugin behavior

`SESSION_SECONDS` is a fixed 3600-second defensive bound, not a user-configurable
recording duration. The wall timer starts when connect begins, including model
startup. Independently, the audio guard rejects the entire incoming frame if
accepted bytes plus that frame would reach or exceed 28,800,000 PCMU bytes.
Therefore exactly 60 minutes of supplied audio is not accepted. Neither guard
calls the normal bounded final drain: both call fail(), clear assembled text and
queued/retained audio, stop the managed decoder, and emit only onError. A late
in-flight result is suppressed. There is no disk recovery of previously decoded
speech. This is explicitly a release limitation, not a usable 60-minute timeout.

## Why a safe automatic completion is not implemented here

The official [provider callbacks](https://github.com/openclaw/openclaw/blob/d30287734dee7ab3d86b216777c11ea195a021b8/src/realtime-transcription/provider-types.ts)
offer onPartial, onTranscript, onSpeechStart and onError. There is no provider-to-
host successful stop-capture/drain handshake or accepted-sample acknowledgment.
Calling the provider's own close method controls its inference state, not browser
capture. [Relay callbacks](https://github.com/openclaw/openclaw/blob/d30287734dee7ab3d86b216777c11ea195a021b8/src/gateway/talk/transcription-relay.ts#L300-L355)
forward a transcript without closing capture; onError closes the relay. The
[stock composer event path](https://github.com/openclaw/openclaw/blob/d30287734dee7ab3d86b216777c11ea195a021b8/ui/src/pages/chat/composer-dictation.ts#L270-L327)
accumulates finals, ignores completed-close as an auto-stop instruction, and
routes errors into interrupted-session handling. The
[controller](https://github.com/openclaw/openclaw/blob/d30287734dee7ab3d86b216777c11ea195a021b8/ui/src/pages/chat/composer-dictation.ts#L627-L705)
then commits any existing snapshot immediately; subsequent final tails do not
replace that snapshot.

Thus final-then-error can recover already-published text as an interruption, but
cannot be described as a successful complete 60-minute recording: microphone
capture continues during inference and the protocol does not agree which final
sample is included. Error-first removes the relay before an asynchronous final.
We retain the explicitly disclosed release limitation rather than silently stop
accepting speech while the browser still indicates recording. A supported host
change must stop capture visibly, acknowledge the accepted boundary, permit
bounded final draining, and preserve recovered text with an incomplete status if
necessary. Increasing TTL alone does not implement that contract.

Stock expiry still occurs first at 30 minutes and can remove the relay before
final drain. A 60-minute recording requires startup/finalization allowance (the
separate review proposes roughly 65 minutes for the host guard) and graceful
expiry handling; see [host TTL research](host-ttl-change.md). None is implemented
or deployed here. No 60-minute support claim is made.

## Tests

The provider suite tests the audio and wall guards independently, including
previously decoded text plus an in-flight result at wall expiry. Additional stock
controller tests show (1) final plus completed-close leaves capture active until
explicit user Stop, and (2) final-then-error commits only the existing snapshot,
reports interruption, and ignores a later final. Both assert no chat-send RPC.
These are source-level tests with simulated microphone/RPC, not real-browser or
near-hour integration evidence. Production runtime semantics are unchanged.

Validation: 89 Node and 18 Python tests pass; all six stock-controller checks
pass. No GPU rerun is needed for this test/documentation-only audit.
