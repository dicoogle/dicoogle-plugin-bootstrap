import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import { buildQueryIndexModel } from "../src/model.mjs";
import {
  QUERY_INDEX_CASES,
  queryIndexModel,
  queryIndexValues,
} from "./helpers.mjs";

const EXPECTED = {
  ingest: {
    capabilities: ["ingest"],
    interfaces: ["StorageIngestEventListener"],
  },
  query: {
    capabilities: ["query"],
    interfaces: ["QueryService"],
  },
  move: {
    capabilities: ["move"],
    interfaces: ["QueryMoveService"],
  },
  maintenance: {
    capabilities: ["maintenance"],
    interfaces: ["QueryIndexMaintenance"],
  },
  settings: {
    capabilities: ["settings"],
    interfaces: ["QueryIndexPlugin", "QueryIndexSettings"],
  },
  all: {
    capabilities: [
      "ingest",
      "query",
      "move",
      "maintenance",
      "settings",
    ],
    interfaces: [
      "StorageIngestEventListener",
      "QueryService",
      "QueryMoveService",
      "QueryIndexMaintenance",
      "QueryIndexSettings",
    ],
  },
};

test("query-index capability closure matches the design table", () => {
  for (const [name, flags, values = {}] of QUERY_INDEX_CASES) {
    const model = queryIndexModel(flags, values);
    const expected = EXPECTED[name] ?? EXPECTED.all;

    assert.deepEqual(model.capabilities, expected.capabilities, name);
    assert.deepEqual(model.interfaces, expected.interfaces, name);
  }
});

test("query-index identity and defaults are derived from the model", () => {
  const model = queryIndexModel({ ingest: true });

  assert.equal(model.family, "query-index");
  assert.equal(model.domain, "query");
  assert.equal(model.pluginType, "query-index");
  assert.equal(model.artifactId, "dicoogle-next-query-my-index");
  assert.equal(model.package, "org.dicoogle.query.myindex");
  assert.equal(model.packagePath, "org/dicoogle/query/myindex");
  assert.equal(model.configPrefix, "app.query.my-index");
  assert.equal(model.className, "MyIndexQueryIndexPlugin");
  assert.equal(model.indexId, "my-index");
  assert.equal(model.enabledDefault, true);
  assert.equal(model.matchIfMissing, true);
  assert.equal(model.out, model.artifactId);
  assert.equal(model.licenseHeader, "");
});

test("settings alone adds the QueryIndexPlugin marker", () => {
  const model = queryIndexModel({ settings: true });

  assert.deepEqual(model.interfaces, [
    "QueryIndexPlugin",
    "QueryIndexSettings",
  ]);
});

test("maintenance already extends QueryIndexPlugin", () => {
  const model = queryIndexModel({ maintenance: true });

  assert.deepEqual(model.interfaces, ["QueryIndexMaintenance"]);
  assert.ok(!model.interfaces.includes("QueryIndexPlugin"));
});

test("query-index requires at least one capability", () => {
  assert.throws(
    () => buildQueryIndexModel({ flags: {}, values: queryIndexValues() }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /requires at least one/.test(error.message),
  );
});

test("query-index rejects --locator with exit 2", () => {
  assert.throws(
    () =>
      buildQueryIndexModel({
        flags: { locator: true, query: true },
        values: queryIndexValues(),
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /--locator is not supported/.test(error.message),
  );
});

test("query-index model rejects non-query-index families", () => {
  assert.throws(
    () =>
      buildQueryIndexModel({
        flags: { ingest: true },
        values: queryIndexValues({ family: "storage" }),
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /requires --family "query-index"/.test(error.message),
  );
});

test("query-index license produces one SPDX line", () => {
  const model = queryIndexModel(
    { settings: true },
    { license: "MIT" },
  );

  assert.equal(model.licenseHeader, "// SPDX-License-Identifier: MIT");
});
