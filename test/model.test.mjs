import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import { buildStorageModel } from "../src/model.mjs";
import { STORAGE_CASES, storageModel, storageValues } from "./helpers.mjs";

const EXPECTED = {
  readable: {
    readable: true,
    writable: false,
    listable: false,
    locator: false,
    interfaces: ["ReadableStoragePlugin"],
    capabilities: ["readable"],
  },
  writable: {
    readable: false,
    writable: true,
    listable: false,
    locator: false,
    interfaces: ["WritableStoragePlugin"],
    capabilities: ["writable"],
  },
  listable: {
    readable: true,
    writable: false,
    listable: true,
    locator: false,
    interfaces: ["ListableStoragePlugin"],
    capabilities: ["readable", "listable"],
  },
  locator: {
    readable: true,
    writable: false,
    listable: false,
    locator: true,
    interfaces: ["ReadableStoragePlugin", "DicomInstanceLocator"],
    capabilities: ["readable", "locator"],
  },
  "readable-writable": {
    readable: true,
    writable: true,
    listable: false,
    locator: false,
    interfaces: ["ReadableStoragePlugin", "WritableStoragePlugin"],
    capabilities: ["readable", "writable"],
  },
  "writable-locator": {
    readable: false,
    writable: true,
    listable: false,
    locator: true,
    interfaces: ["WritableStoragePlugin", "DicomInstanceLocator"],
    capabilities: ["writable", "locator"],
  },
  all: {
    readable: true,
    writable: true,
    listable: true,
    locator: true,
    interfaces: [
      "ListableStoragePlugin",
      "WritableStoragePlugin",
      "DicomInstanceLocator",
    ],
    capabilities: [
      "readable",
      "writable",
      "listable",
      "locator",
    ],
  },
};

test("storage closure and interfaces match the design table", () => {
  for (const [name, flags] of STORAGE_CASES) {
    const model = storageModel(flags);
    const expected = EXPECTED[name];

    assert.equal(model.readable, expected.readable, name);
    assert.equal(model.writable, expected.writable, name);
    assert.equal(model.listable, expected.listable, name);
    assert.equal(model.locator, expected.locator, name);
    assert.deepEqual(model.interfaces, expected.interfaces, name);
    assert.deepEqual(model.capabilities, expected.capabilities, name);
    assert.ok(
      !model.interfaces.includes("QueryIndexStorageLocator"),
      name,
    );
  }
});

test("zero storage flags defaults to readable", () => {
  const model = storageModel({});

  assert.equal(model.readable, true);
  assert.equal(model.writable, false);
  assert.equal(model.listable, false);
  assert.equal(model.locator, false);
  assert.deepEqual(model.interfaces, ["ReadableStoragePlugin"]);
});

test("storage identity and defaults are derived from the model", () => {
  const model = storageModel({ readable: true });

  assert.equal(model.id, "my-store");
  assert.equal(model.domain, "storage");
  assert.equal(model.pluginType, "storage");
  assert.equal(
    model.artifactId,
    "dicoogle-next-storage-my-store",
  );
  assert.equal(model.package, "org.dicoogle.storage.mystore");
  assert.equal(
    model.packagePath,
    "org/dicoogle/storage/mystore",
  );
  assert.equal(model.configPrefix, "app.storage.my-store");
  assert.equal(model.scheme, "my-store");
  assert.equal(model.className, "MyStoreStoragePlugin");
  assert.equal(model.enabledDefault, false);
  assert.equal(model.matchIfMissing, false);
  assert.equal(model.out, model.artifactId);
  assert.equal(model.licenseHeader, "");
});

test("license produces one SPDX comment line", () => {
  const model = storageModel(
    { readable: true },
    { license: "GPL-3.0-only" },
  );

  assert.equal(
    model.licenseHeader,
    "// SPDX-License-Identifier: GPL-3.0-only",
  );
});

test("type override flows into pluginType", () => {
  const model = storageModel(
    { readable: true },
    { type: "custom-type" },
  );

  assert.equal(model.pluginType, "custom-type");
});

test("explicit package, scheme, and out are preserved", () => {
  const model = buildStorageModel({
    flags: {
      readable: true,
      out: "/tmp/my-store",
    },
    values: storageValues({
      package: "com.example.mystore",
      scheme: "custom",
    }),
  });

  assert.equal(model.package, "com.example.mystore");
  assert.equal(
    model.packagePath,
    "com/example/mystore",
  );
  assert.equal(model.scheme, "custom");
  assert.equal(model.out, "/tmp/my-store");
});

test("storage model rejects non-storage families", () => {
  assert.throws(
    () =>
      buildStorageModel({
        flags: {},
        values: storageValues({ family: "query-index" }),
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /requires --family "storage"/.test(error.message),
  );
});
