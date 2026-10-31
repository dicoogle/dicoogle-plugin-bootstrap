import assert from "node:assert/strict";
import test from "node:test";

import { lowerCamelCase } from "../src/naming.mjs";
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

function configFile(files, className) {
  return files.find((file) =>
    file.path.endsWith(`/${className}Config.java`),
  );
}

test("lowerCamelCase derives Spring bean names from class names", () => {
  assert.equal(lowerCamelCase("MyAuditIngestListener"), "myAuditIngestListener");
  assert.equal(lowerCamelCase("MyDicomStoreStoragePlugin"), "myDicomStoreStoragePlugin");
  assert.equal(lowerCamelCase("MyIndexQueryIndexPlugin"), "myIndexQueryIndexPlugin");
});

test("storage config method name is unique per plugin id", () => {
  const lock = loadLock();
  const a = storageModel({ readable: true }, { id: "collision-a" });
  const b = storageModel({ readable: true }, { id: "collision-b" });

  assert.equal(a.beanName, "collisionAStoragePlugin");
  assert.equal(b.beanName, "collisionBStoragePlugin");
  assert.notEqual(a.beanName, b.beanName);

  const aConfig = configFile(materializePlan(buildStoragePlan(a, lock)), a.className);
  const bConfig = configFile(materializePlan(buildStoragePlan(b, lock)), b.className);

  assert.ok(aConfig);
  assert.ok(bConfig);
  assert.match(aConfig.content, /collisionAStoragePlugin\(/);
  assert.match(bConfig.content, /collisionBStoragePlugin\(/);
});

test("query-index config method name is unique per plugin id", () => {
  const lock = loadLock();
  const a = queryIndexModel({ query: true }, { id: "collision-a" });
  const b = queryIndexModel({ query: true }, { id: "collision-b" });

  assert.equal(a.beanName, "collisionAQueryIndexPlugin");
  assert.equal(b.beanName, "collisionBQueryIndexPlugin");
  assert.notEqual(a.beanName, b.beanName);

  const aConfig = configFile(
    materializePlan(buildQueryIndexPlan(a, lock)),
    a.className,
  );
  const bConfig = configFile(
    materializePlan(buildQueryIndexPlan(b, lock)),
    b.className,
  );

  assert.ok(aConfig);
  assert.ok(bConfig);
  assert.match(aConfig.content, /collisionAQueryIndexPlugin\(/);
  assert.match(bConfig.content, /collisionBQueryIndexPlugin\(/);
});

test("listener config method names are unique per plugin id", () => {
  const lock = loadLock();
  const ingestA = listenerModel({ ingest: true }, { id: "collision-a" });
  const ingestB = listenerModel({ ingest: true }, { id: "collision-b" });
  const retrieveA = listenerModel({ retrieve: true }, { id: "collision-a" });
  const retrieveB = listenerModel({ retrieve: true }, { id: "collision-b" });

  assert.equal(ingestA.beanName, "collisionAIngestListener");
  assert.equal(ingestB.beanName, "collisionBIngestListener");
  assert.equal(retrieveA.beanName, "collisionARetrieveListener");
  assert.equal(retrieveB.beanName, "collisionBRetrieveListener");

  for (const model of [ingestA, ingestB, retrieveA, retrieveB]) {
    const plan =
      model.family === "listener"
        ? buildListenerPlan(model, lock)
        : null;
    const config = configFile(materializePlan(plan), model.className);

    assert.ok(config);
    assert.match(config.content, new RegExp(`${model.beanName}\\(`));
  }
});
