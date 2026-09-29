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

The provider decodes bounded overlapping windows during capture. All transcript
assembly remains internal until Stop. The stock activity meter still works.

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

The plugin's independent audio/wall ceiling is 60 minutes, but the stock relay
has a fixed 30-minute lifetime and offers no renewal hook. Queue overflow, transcript
bounds, or either plugin ceiling fail explicitly with no final transcript. Since no
partial is exposed, the stock error-stop path cannot insert a misleading prefix.

`scripts/composer-smoke.mjs` executes the unmodified stock controller and session,
with fake capture/RPC and the real provider session implementation. One test
reproduces the stale partial bug; the regression test keeps a three-byte tail,
checks that nothing commits before the late-final drain closes, verifies exact
final insertion and asserts that no chat-send RPC occurs. This is stronger than
checking provider callbacks in isolation. It is not a real browser/microphone test.

`scripts/composer-path.mjs` additionally routes synthetic microphone samples through
stock capture encoding, stock controller/session, actual host relay, and the real
GPU worker, then checks late editable insertion and absence of chat-send RPCs.
This is an in-process integration replay, not a real browser, network, or mic test.
