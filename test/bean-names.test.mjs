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

test("hyphenated and plain ids share a package but not classes or beans", () => {
  const lock = loadLock();
  const cases = [
    [
      "storage",
      (id) => storageModel({ readable: true }, { id }),
      buildStoragePlan,
      "FooBarStoragePlugin",
      "FoobarStoragePlugin",
      "fooBarStoragePlugin",
      "foobarStoragePlugin",
      "org.dicoogle.storage.foobar",
    ],
    [
      "query-index",
      (id) => queryIndexModel({ query: true }, { id }),
      buildQueryIndexPlan,
      "FooBarQueryIndexPlugin",
      "FoobarQueryIndexPlugin",
      "fooBarQueryIndexPlugin",
      "foobarQueryIndexPlugin",
      "org.dicoogle.query.foobar",
    ],
    [
      "listener ingest",
      (id) => listenerModel({ ingest: true }, { id }),
      buildListenerPlan,
      "FooBarIngestListener",
      "FoobarIngestListener",
      "fooBarIngestListener",
      "foobarIngestListener",
      "org.dicoogle.query.foobar",
    ],
    [
      "listener retrieve",
      (id) => listenerModel({ retrieve: true }, { id }),
      buildListenerPlan,
      "FooBarRetrieveListener",
      "FoobarRetrieveListener",
      "fooBarRetrieveListener",
      "foobarRetrieveListener",
      "org.dicoogle.service.foobar",
    ],
  ];

  for (const [
    name,
    makeModel,
    buildPlan,
    fooBarClass,
    foobarClass,
    fooBarBean,
    foobarBean,
    packageName,
  ] of cases) {
    const fooBar = makeModel("foo-bar");
    const foobar = makeModel("foobar");

    assert.equal(fooBar.className, fooBarClass, name);
    assert.equal(foobar.className, foobarClass, name);
    assert.equal(fooBar.beanName, fooBarBean, name);
    assert.equal(foobar.beanName, foobarBean, name);
    assert.equal(fooBar.package, packageName, name);
    assert.equal(foobar.package, packageName, name);
    assert.notEqual(fooBar.className, foobar.className, name);
    assert.notEqual(fooBar.beanName, foobar.beanName, name);

    const fooBarConfig = configFile(
      materializePlan(buildPlan(fooBar, lock)),
      fooBar.className,
    );
    const foobarConfig = configFile(
      materializePlan(buildPlan(foobar, lock)),
      foobar.className,
    );

    assert.ok(fooBarConfig, name);
    assert.ok(foobarConfig, name);
    assert.match(fooBarConfig.content, new RegExp(`${fooBar.beanName}\\(`), name);
    assert.match(foobarConfig.content, new RegExp(`${foobar.beanName}\\(`), name);
  }
});
