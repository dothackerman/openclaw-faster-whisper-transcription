// Real stock capture/relay/composer path, deterministic subprocess instead of GPU.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { parseConfig } from "../dist/config.js";
import { ComposerPathRuntime } from "./composer-path.mjs";
for (const model of ["medium", "silence", "uncertain"])
  test(
    `stock relay path ${model} finishes without sending`,
    { timeout: 15000 },
    async (t) => {
      const runtime = new ComposerPathRuntime(
        parseConfig({
          python: resolve("tests/fake-worker.py"),
          modelPath: "/tmp",
          model,
        }),
      );
      t.after(() => runtime.dispose());
      let finish, fail;
      const final = new Promise((r, j) => {
        finish = r;
        fail = j;
      });
      final.catch(() => {});
      const session = runtime.provider().createSession({
        providerConfig: {},
        onTranscript: finish,
        onError: fail,
      });
      await session.connect();
      session.sendAudio(Buffer.alloc(800, 255));
      session.close();
      assert.equal(
        await final,
        model === "silence"
          ? ""
          : model === "uncertain"
            ? "[uncertain: earlier: not approved | later: approved]"
            : "Synthetic result.",
      );
      assert.equal(runtime.metrics.inputHash, runtime.metrics.relayHash);
      assert.equal(runtime.metrics.onlyTalkRpcs, true);
      if (model === "silence") {
        assert.equal(runtime.metrics.composerInsertMs, null);
        assert.equal(runtime.metrics.committed, false);
      } else {
        assert.equal(runtime.metrics.late, true);
        assert.ok(runtime.metrics.composerInsertMs >= 4900);
      }
    },
  );
