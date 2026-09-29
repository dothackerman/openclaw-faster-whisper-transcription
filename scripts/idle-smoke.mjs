// Optional isolated GPU lifecycle proof. No live Gateway or shared process control.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { Runtime } from "../dist/provider.js";
import { parseConfig } from "../dist/config.js";
const config = parseConfig({
  ...JSON.parse(await readFile(process.argv[2], "utf8")),
  idleSeconds: 1,
});
const memory = () =>
  Number(
    execFileSync(
      "nvidia-smi",
      ["--query-gpu=memory.used", "--format=csv,noheader,nounits"],
      { encoding: "utf8" },
    ).trim(),
  );
const baseline = memory(),
  runtime = new Runtime(config);
try {
  const session = runtime.provider().createSession({ providerConfig: {} });
  await session.connect();
  // Test-only inspection of our own subprocess; no search or kill of unrelated PIDs.
  const child = runtime.decoder.child;
  const pid = child.pid;
  const exited = new Promise((resolve) => child.once("close", resolve));
  const loaded = memory();
  session.close();
  await exited;
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  const after = memory();
  const result = {
    baselineMemoryMiB: baseline,
    loadedMemoryMiB: loaded,
    afterIdleMemoryMiB: after,
    ownedChildExited: true,
    idleSeconds: 1,
  };
  await writeFile(
    process.argv[3] ?? ".local/idle-smoke.json",
    JSON.stringify(result, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify(result));
} finally {
  await runtime.dispose();
}
