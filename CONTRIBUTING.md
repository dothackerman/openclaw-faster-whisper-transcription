# Contributing

Use Node 24 and Python 3.12. Changes must pass `npm test`, `npm run format:check`,
and `npm run package:check`. Test against the exact OpenClaw SDK and run the
source contract/composer scripts before changing lifecycle or transcript behavior.
Do not work against a live Gateway. Keep model environments and caches separate.

Never add private recordings, transcripts, credentials, or environment dumps to a
PR. Public speech fixtures are generated from self-authored scripts; new fixtures
need explicit provenance and redistribution rights. Keep unsuccessful experiments
in the ledger. State whether results are synthetic, offline, provider-path, or
real browser/microphone measurements. A successful callback test is insufficient
evidence that the stock composer inserts the right text.
