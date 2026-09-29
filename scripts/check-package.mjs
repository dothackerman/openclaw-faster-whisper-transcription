import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [pack] = JSON.parse(await readFile(process.argv[2], "utf8"));
const paths = pack.files.map((f) => f.path);
for (const required of [
  "dist/index.js",
  "dist/provider.js",
  "dist/worker.js",
  "openclaw.plugin.json",
  "python/worker.py",
  "python/requirements-gpu.lock",
  "scripts/bootstrap.py",
  "LICENSE",
  "README.md",
])
  assert.ok(paths.includes(required), `Missing ${required}`);
for (const path of paths)
  assert.ok(
    /^(dist\/[^/]+\.(js|d.ts)|python\/(worker.py|requirements[^/]*\.(txt|lock))|scripts\/bootstrap.py|openclaw.plugin.json|package.json|README.md|LICENSE|SECURITY.md|CONTRIBUTING.md|docs\/[^/]+\.md)$/.test(
      path,
    ),
    `Unexpected public artifact: ${path}`,
  );
console.log(
  `PASS: ${paths.length} explicitly allowed package files; no fixtures, research, environments, audio, or local results`,
);
