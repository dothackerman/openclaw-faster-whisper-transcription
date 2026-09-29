# Recovered words inside an expanded seal

The connected-crossing change fixed a word crossing the original seam being
printed as definite tail. It also expanded `sealedUntil` to that word's end.
Filtering every future word ending before that timestamp silently lost new
hypothesis evidence. Exact reproduction: old7.6–7.9, fresh broad7.6–12, then
recovered11.6–11.8 plus future12.5–12.7. The old filter returned only future.
This P1 also affects a broad retry word. Passing rapid fixtures did not negate it.

## Retry-start boundary

Ordinary-window monotonicity does not apply to the optional wider-context retry.
The provider now additionally requires `retryStart / 8000 > sealedUntil` before
allocating or decoding retry audio. retryStart is an integer PCMU byte/sample
offset. Equality is rejected too, covering zero-duration words at the frontier.
A crossing/touching retry is skipped; the ordinary earlier/later readings remain
labeled. This does not discard observed retry evidence: the unsafe decode is never
launched. If evidence nevertheless reaches add or marking through a bypass, the
existing bounded witness guard still rejects any unaccounted recovered word.

Adversary: first seal ends at 23.5, next ordinary window starts at 24 and conflicts at 25;
its wider retry would start at 20 and could recover not@21. The opt-in provider test
asserts that this retry is not launched, the ordinary conflict stays marked, and
only the first safe retry is counted. A direct retry-only not@21 test requires
both add and markUncertain to throw without mutation. A boundary test checks one
PCMU sample before, exactly at, and one sample after the seal, plus invalid values
and reset. 103 Node/18 Python tests pass. Default off is unchanged. No GPU run,
quality claim, live change or push; prior opt-in retry measurements predate this
additional eligibility restriction.

## Strict next-window frontier

The provider now passes `safeNextStart = (start + advance) / 8000`, computed
from the actual fixed-stride or pause endpoint before inference. After connected
closure includes old, fresh and retry words, markUncertain requires finite
`safeNextStart` and strict `seamEnd < safeNextStart`, before any state mutation.
Failure is a non-AlignmentError: `sealed overlap reaches future audio; no complete
transcript is available`. It cannot trigger another marker or a successful final.
No Infinity exemption is used for final windows. This adds a constant-time bound
check to the existing closure.

Ordinary subsequent windows begin at or beyond that frontier. Worker validation
requires nonnegative relative starts and end >= start (zero duration is allowed).
Their words therefore end strictly after sealedUntil and cannot disappear in its
time filter. Optional wider-context retry decodes can look backward only without reaching
the seal; the retry-start gate above enforces this. The bounded single-reading
witness guard below remains a second defense for bypassed or rewound callers.
An incorrectly rewound caller likewise fails instead of silently discarding words.

Exact 6..12 window/nextStart11.5 cases: broad ending12 or11.5 throws without
changing text/counters; ending11.49 succeeds, and subsequent not@11.5–11.5,
recovered@11.6–11.8 and future@12.5–12.7 all survive. Long retry words participate
in the same closure. A real provider pause-endpoint test uses current3.5..8,
advance4, proving that closure7.5 is rejected against nextStart7.5 rather than
accepted against window end8. Fixed16/4 provider regression fails at the initial
bad seal, before another window is decoded.100 Node/18 Python tests pass.
No GPU run is needed for this targeted invariant; prior rapid/five-minute runs do
not qualify the stricter failure behavior. Draft loss on explicit error remains a
release limitation, not silent successful truncation.

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

## Short validation — clean `293c521`

5/5 rapid finals, exactly the same five texts as the previous no-retry rapid
profile. Visible WER34/142 (23.94%), CER153/899 (17.02%), four spans/178 marker
characters, zero retries, maximum final799ms. Keep the explicit conflict guard;
reject quality/usability acceptance. This short screen is not proof that legitimate
long overlaps will avoid fail-closed rejection. No five-minute run was performed.
Nine stock controller/relay checks and format/fixture/package/extracted native-
loader checks pass. Raw run remains local; ledger ID seal-proof-rapid.
