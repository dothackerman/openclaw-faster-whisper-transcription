# Recovered words inside an expanded seal

The connected-crossing change fixed a word crossing the original seam being
printed as definite tail. It also expanded `sealedUntil` to that word's end.
Filtering every future word ending before that timestamp silently lost new
hypothesis evidence. Exact reproduction: old7.6–7.9, fresh broad7.6–12, then
recovered11.6–11.8 plus future12.5–12.7. The old filter returned only future.
This P1 also affects a broad retry word. Passing rapid fixtures did not negate it.

## Conservative correction

Keep up to three readings of at most512 original timed Word witnesses from the
last sealed join. Before excluding a future word on time grounds, require every
covered word to match a unique exact NFC surface within0.8s midpoint tolerance,
in monotone order in ONE retained source reading. Surface, punctuation, case,
Word boundaries and source provenance are not normalized away. Repeated or
unsupported matches fail. If evidence is missing, throw a fatal error before
mutation, not AlignmentError: retry/marking cannot overwrite the immutable text
and must not hide the same new evidence again. Both add and markUncertain check
this; a retry containing previously sealed words is checked too. clear resets
the witnesses. New witnesses are installed only after transcript bounds pass.

This is a conservative fail-closed policy, not proof of ASR completeness. The
bounded history may reject a legitimate older overlap, especially a wide retry;
that is preferable to silently suppressing recovered speech. Provider failure
still discards the session draft under the existing final-only contract. This
is a release limitation; no claim of loss-safe long dictation is made. A future
revision would need a bounded, source-preserving replacement of already marked
spans rather than a timestamp-only discard frontier.

Tests cover the exact reproduction, recovered negation, long retry variant,
direct markUncertain bypass, punctuation mismatch, repeated-word count and mixed-
source prefix rejection, plus provider error-only/no-final behavior. Existing
known-repeat crossing/tail regressions still pass.95 Node/18 Python pass.
Plan: commit and run the short default-no-retry screen; no five-minute run or push
is needed to establish the deterministic fix. Previous five-minute metrics do
not qualify this stricter sealed-overlap handling.
