import assert from "node:assert/strict";

export function checkSubset(canonical, subset, expectedIds) {
  assert.equal(subset.version, canonical.version);
  assert.deepEqual(subset.provenance, canonical.provenance);
  assert.deepEqual(
    subset.fixtures.map((f) => f.id).sort(),
    [...expectedIds].sort(),
  );
  for (const fixture of subset.fixtures) {
    const original = canonical.fixtures.find((f) => f.id === fixture.id);
    assert.ok(original, `Unknown subset fixture: ${fixture.id}`);
    // Includes reference, hash, duration, language, split and provenance fields.
    assert.deepEqual(fixture, original, `Subset drift: ${fixture.id}`);
  }
}
