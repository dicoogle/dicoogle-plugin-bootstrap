import assert from "node:assert/strict";
import test from "node:test";

import { loadLock } from "../src/lock.mjs";
import {
  buildListenerPlan,
  buildQueryIndexPlan,
  buildStoragePlan,
  materializePlan,
} from "../src/plan.mjs";
import {
  listenerModel,
  queryIndexModel,
  storageModel,
} from "./helpers.mjs";

const CASES = [
  ["storage", storageModel({ readable: true }), buildStoragePlan],
  ["query-index", queryIndexModel({ query: true }), buildQueryIndexPlan],
  ["listener", listenerModel({ ingest: true }), buildListenerPlan],
];

test("generated READMEs document standalone and in-repo builds", () => {
  const lock = loadLock();

  for (const [name, model, buildPlan] of CASES) {
    const files = materializePlan(buildPlan(model, lock));
    const readme = files.find((file) => file.path === "README.md");

    assert.ok(readme, name);
    assert.match(readme.content, /# set enabled: true to activate/, name);
    assert.match(readme.content, /enabled: false/, name);
    assert.match(readme.content, /### Standalone mode/, name);
    assert.match(readme.content, /mvnw -B -ntp -N install/, name);
    assert.match(
      readme.content,
      /mvnw -B -ntp -pl dicoogle-next-sdk -am install/,
      name,
    );
    assert.match(readme.content, /### In-repo mode/, name);
    assert.match(readme.content, /backend\/pom\.xml/, name);
    assert.match(
      readme.content,
      /backend\/dicoogle-next\/pom\.xml/,
      name,
    );
    assert.match(
      readme.content,
      new RegExp(`plugins/${model.artifactId}`),
      name,
    );
  }
});
