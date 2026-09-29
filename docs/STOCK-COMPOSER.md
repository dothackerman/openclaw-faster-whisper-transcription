# Stock composer compatibility: P1 correction

Verified against OpenClaw v2026.9.6 prepared source, commit
`d30287734dee7ab3d86b216777c11ea195a021b8` plus local patch.

`ComposerDictationController.stop()` (composer-dictation.ts:659 onward) takes
`session.transcriptSnapshot()` **before** it calls `finish()`. Any nonempty
partial or accumulated final is immediately committed. It then calls
`finish()` without final draining and ignores that return value. Thus a provider
that emits streaming partials cannot reliably replace them after Stop. The
original roadmap and initial implementation missed this controller behavior.

There is no preview-only event or final-completion acknowledgement in the public
provider contract. Clearing a partial in `close()` is too late. Emitting finals
while speaking has the same problem. An error callback is not a successful
completion signal. Timing a preview-clear against hypothetical mouse events is
not reliable. We therefore **emit no partial callbacks**. This trades live text
preview for correct final-tail insertion without modifying OpenClaw.

The default does one full decode on Stop. Optional `snapshotIntervalSeconds`
(default 0, disabled) can precompute internal snapshots for experiments; those
snapshots are never sent to the UI or promoted when trailing audio is undecoded.
The stock microphone activity meter still works.

With an empty snapshot, the controller uses `finish(true)`, installs its late-final
listener before closing, and eventually inserts the complete final as editable
composer text. It sends no chat message. The late-final listener waits for the
relay's **close event**, even if the final arrives earlier: the actual relay
closes after its five-second drain window. Consequently, approximately five
seconds Stop-to-composer insertion is an existing host constraint, not our
inference latency. The browser's ten-second outer wait is not an inference budget.

The provider uses a 4.5-second stop deadline, leaving 0.5 seconds of relay margin.
This is a compatibility bound, not a measured performance claim. Longer decode
budgets cannot fix the stock path: the relay would already have discarded finals.
If it expires, the provider reports failure and inserts no speculative transcript.

The audio duration bound is configurable (1–120 seconds). At the limit, the
provider finalizes accepted audio and emits a visible duration-limit notice only
**after** its final callback. This lets the stock error-stop path retain the
accepted text, instead of dropping the whole dictation on overflow. Subsequent
frames are ignored while that bounded final is in flight. This behavior needs
real microphone acceptance along with latency measurements; a high configured
limit is not a promise that its decode fits the relay deadline.

`scripts/composer-smoke.mjs` executes the unmodified stock controller and session,
with fake capture/RPC and the real provider session implementation. One test
reproduces the stale partial bug; the regression test keeps a three-byte tail,
checks that nothing commits before the late-final drain closes, verifies exact
final insertion and asserts that no chat-send RPC occurs. This is stronger than
checking provider callbacks in isolation. It is not a real browser/microphone test.
