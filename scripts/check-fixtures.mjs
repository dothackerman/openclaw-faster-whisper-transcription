// Provenance/hash gate, not an automated proof that a recording is public.
// Review newly added scripts and audio provenance before publishing any new fixture.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../fixtures/public/", import.meta.url),
  known = new Set();
for (const name of ["manifest.json", "long-manifest.json"]) {
  const manifest = JSON.parse(await readFile(new URL(name, root), "utf8"));
  assert.equal(manifest.provenance.kind, "synthetic");
  assert.equal(manifest.provenance.engine, "eSpeak NG");
  for (const fixture of manifest.fixtures) {
    assert.match(fixture.file, /^[a-z0-9-]+\.ulaw$/);
    assert.ok(!known.has(fixture.file));
    known.add(fixture.file);
    const audio = await readFile(new URL(fixture.file, root));
    assert.equal(
      createHash("sha256").update(audio).digest("hex"),
      fixture.sha256,
      fixture.id,
    );
    assert.equal(audio.length / 8000, fixture.seconds, fixture.id);
    assert.equal(fixture.mic, "synthetic");
  }
}
for (const name of await readdir(root))
  assert.ok(
    name.endsWith(".json") || known.has(name),
    `Unmanifested public file: ${name}`,
  );
console.log(
  `PASS: ${known.size} generated public audio files match declared hashes and durations`,
);
