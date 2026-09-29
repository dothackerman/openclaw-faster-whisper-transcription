# Published SDK and clean builds

The development dependency is **`openclaw@2026.9.6`**, pinned in `package.json`
and integrity-locked with its dependency graph in `package-lock.json`. Install
with `npm ci --ignore-scripts`. The SDK is part of the public host package;
imports remain `openclaw/plugin-sdk/plugin-entry`. No private SDK package,
copied declarations, TypeScript path aliases, or ambient stubs are used.

The host remains an optional peer dependency for plugin installation. OpenClaw's
[host peer contract](https://github.com/openclaw/openclaw/blob/v2026.9.6/docs/plugins/dependency-resolution.md#host-peer-dependency)
supplies the running host to managed plugins rather than installing another
runtime host. The pinned development dependency supplies types and runtime
exports for standalone compilation/tests; it is not bundled into our tarball.
The source workspace's private `@openclaw/plugin-sdk` package is not the public
development dependency.

## CI failure and reproduction

The [original public run](https://github.com/dothackerman/openclaw-faster-whisper-transcription/actions/runs/36540477251)
failed at TypeScript SDK resolution. Locally reproducing its sequence with npm
11.17.0 (`npm ci`, then `npm install --no-save --ignore-scripts
--package-lock=false openclaw@2026.9.6`) reported success but `npm ls openclaw`
was empty: an optional peer alone did not materialize the package. The previous
local checkout symlink masked this missing development dependency. The implicit
`any` diagnostics follow from the unresolved SDK, not a need to weaken typing.

The actual registry tarball contains both export targets:
`dist/plugin-sdk/plugin-entry.d.ts` and `dist/plugin-sdk/plugin-entry.js`.
Its SHA-512 integrity is
`sha512-Ie0kyQSCVfFqixsgVg39vevUDq01Ch5u3+7Yu5Y3qARczmdAe+lzp8bVnO9925rHiW/+CFp70zfORCyPmCH31g==`.
This matches the locked package. With the exact development dependency, a fresh
installation outside the repository resolves the public SDK locally and strict
TypeScript compilation succeeds without the prepared source checkout.

CI now uses only the committed lockfile via `npm ci`, checks `npm ls openclaw`,
then runs compilation, tests, formatting, and package-boundary validation.
Installing dependencies never installs this plugin in a Gateway, runs OpenClaw,
or reads a live configuration. Lifecycle install scripts remain disabled.
Source-level relay/composer integration tests are separate, additional checks
against the read-only prepared host; they do not replace the published-SDK build.
