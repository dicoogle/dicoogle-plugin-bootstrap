import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import { buildListenerModel } from "../src/model.mjs";
import {
  LISTENER_CASES,
  listenerModel,
  listenerValues,
} from "./helpers.mjs";

test("listener identities follow Addendum A", () => {
  const ingest = listenerModel({ ingest: true });

  assert.equal(ingest.listenerKind, "ingest");
  assert.equal(ingest.domain, "query");
  assert.equal(ingest.pluginType, "query-index");
  assert.equal(ingest.artifactId, "dicoogle-next-query-my-audit");
  assert.equal(ingest.package, "org.dicoogle.query.myaudit");
  assert.equal(ingest.configPrefix, "app.query.my-audit");
  assert.equal(ingest.className, "MyAuditIngestListener");
  assert.deepEqual(ingest.interfaces, ["StorageIngestEventListener"]);
  assert.equal(ingest.beanName, "ingestListener");

  const retrieve = listenerModel({ retrieve: true });

  assert.equal(retrieve.listenerKind, "retrieve");
  assert.equal(retrieve.domain, "service");
  assert.equal(retrieve.pluginType, "service");
  assert.equal(retrieve.artifactId, "dicoogle-next-service-my-audit");
  assert.equal(retrieve.package, "org.dicoogle.service.myaudit");
  assert.equal(retrieve.configPrefix, "app.service.my-audit");
  assert.equal(retrieve.className, "MyAuditRetrieveListener");
  assert.deepEqual(retrieve.interfaces, ["StorageRetrieveEventListener"]);
  assert.equal(retrieve.beanName, "retrieveListener");
});

test("listener defaults are enabled with matchIfMissing", () => {
  for (const [name, flags, values = {}] of LISTENER_CASES) {
    const model = listenerModel(flags, values);

    assert.equal(model.family, "listener", name);
    assert.equal(model.enabledDefault, true, name);
    assert.equal(model.matchIfMissing, true, name);
    assert.equal(model.out, model.artifactId, name);
  }
});

test("listener requires exactly one of --ingest or --retrieve", () => {
  for (const flags of [{}, { ingest: true, retrieve: true }]) {
    assert.throws(
      () => buildListenerModel({ flags, values: listenerValues() }),
      (error) =>
        error.exitCode === EXIT_CODES.USAGE &&
        /exactly one of --ingest or --retrieve/.test(error.message),
    );
  }
});

test("listener model rejects non-listener families", () => {
  assert.throws(
    () =>
      buildListenerModel({
        flags: { ingest: true },
        values: listenerValues({ family: "query-index" }),
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /requires --family "listener"/.test(error.message),
  );
});
