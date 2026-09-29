import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSubset } from "../scripts/fixture-subsets.mjs";
test("subset gate rejects changed references, hashes, missing and repeated fixtures", () => {
  const canonical = {
    version: 1,
    provenance: { kind: "synthetic" },
    fixtures: [
      { id: "example", reference: "Do not send", sha256: "hash", seconds: 20 },
    ],
  };
  const copy = () => structuredClone(canonical);
  checkSubset(canonical, copy(), ["example"]);
  for (const field of ["reference", "sha256", "seconds"]) {
    const altered = copy();
    altered.fixtures[0][field] = "changed";
    assert.throws(
      () => checkSubset(canonical, altered, ["example"]),
      /Subset drift/,
    );
  }
  for (const fixtures of [[], [...canonical.fixtures, ...canonical.fixtures]]) {
    assert.throws(() =>
      checkSubset(canonical, { ...copy(), fixtures }, ["example"]),
    );
  }
});
