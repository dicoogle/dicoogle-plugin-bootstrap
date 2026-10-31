import assert from "node:assert/strict";
import test from "node:test";

import {
  artifactIdFor,
  classNameFor,
  configPrefixFor,
  defaultPackageFor,
  deriveJavaIdentity,
  deriveWebIdentity,
  familyDomain,
  findPackageCollisions,
  packageCollisionWarnings,
  packagePath,
  packageSegment,
  pascalCase,
  titleCase,
} from "../src/naming.mjs";

test("section 5.2 conversion table for my-dicom-store", () => {
  const id = "my-dicom-store";

  assert.equal(pascalCase(id), "MyDicomStore");
  assert.equal(titleCase(id), "My Dicom Store");
  assert.equal(packageSegment(id), "mydicomstore");
  assert.equal(
    defaultPackageFor(id, "storage"),
    "org.dicoogle.storage.mydicomstore",
  );
  assert.equal(
    packagePath("org.dicoogle.storage.mydicomstore"),
    "org/dicoogle/storage/mydicomstore",
  );
  assert.equal(
    artifactIdFor(id, "storage"),
    "dicoogle-next-storage-my-dicom-store",
  );
  assert.equal(
    configPrefixFor(id, "storage"),
    "app.storage.my-dicom-store",
  );
  assert.equal(
    classNameFor(id, "StoragePlugin"),
    "MyDicomStoreStoragePlugin",
  );
});

test("family domains map storage and query-index", () => {
  assert.equal(familyDomain("storage"), "storage");
  assert.equal(familyDomain("query-index"), "query");
});

test("listener identity follows D13", () => {
  const ingest = deriveJavaIdentity({
    family: "listener",
    id: "my-audit",
    listenerKind: "ingest",
  });

  assert.equal(ingest.domain, "query");
  assert.equal(ingest.pluginType, "query-index");
  assert.equal(ingest.artifactId, "dicoogle-next-query-my-audit");
  assert.equal(ingest.package, "org.dicoogle.query.myaudit");
  assert.equal(ingest.configPrefix, "app.query.my-audit");
  assert.equal(ingest.className, "MyAuditIngestListener");
  assert.deepEqual(
    ingest.classes.map((entry) => entry.className),
    ["MyAuditIngestListener"],
  );

  const retrieve = deriveJavaIdentity({
    family: "listener",
    id: "my-audit",
    listenerKind: "retrieve",
  });

  assert.equal(retrieve.domain, "service");
  assert.equal(retrieve.pluginType, "service");
  assert.equal(retrieve.artifactId, "dicoogle-next-service-my-audit");
  assert.equal(retrieve.package, "org.dicoogle.service.myaudit");
  assert.equal(retrieve.configPrefix, "app.service.my-audit");
  assert.equal(retrieve.className, "MyAuditRetrieveListener");
});

test("storage identity uses the id as the default scheme", () => {
  const identity = deriveJavaIdentity({
    family: "storage",
    id: "my-dicom-store",
  });

  assert.equal(identity.domain, "storage");
  assert.equal(identity.pluginType, "storage");
  assert.equal(identity.scheme, "my-dicom-store");
  assert.equal(
    identity.artifactId,
    "dicoogle-next-storage-my-dicom-store",
  );
  assert.equal(
    identity.package,
    "org.dicoogle.storage.mydicomstore",
  );
  assert.equal(identity.className, "MyDicomStoreStoragePlugin");
});

test("class suffixes cover the supported families", () => {
  const cases = [
    [
      { family: "storage", id: "x" },
      ["XStoragePlugin"],
    ],
    [
      { family: "query-index", id: "x" },
      ["XQueryIndexPlugin"],
    ],
    [
      { family: "listener", id: "x", listenerKind: "ingest" },
      ["XIngestListener"],
    ],
    [
      { family: "listener", id: "x", listenerKind: "retrieve" },
      ["XRetrieveListener"],
    ],
  ];

  for (const [input, expected] of cases) {
    const identity = deriveJavaIdentity(input);
    assert.deepEqual(
      identity.classes.map((entry) => entry.className),
      expected,
    );
  }
});

test("package collision detection groups hyphen-normalized ids", () => {
  const collisions = findPackageCollisions([
    "foo-bar",
    "foobar",
    "foo-baz",
    "other",
  ]);

  assert.deepEqual(collisions, [
    {
      packageSegment: "foobar",
      ids: ["foo-bar", "foobar"],
    },
  ]);
});

test("package collision warnings name the colliding ids", () => {
  const warnings = packageCollisionWarnings("foo-bar", ["foobar"]);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /package segment "foobar"/);
  assert.match(warnings[0], /collides with "foobar"/);
  assert.match(warnings[0], /--package/);

  assert.deepEqual(packageCollisionWarnings("foo-bar", ["foo-baz"]), []);
  assert.deepEqual(packageCollisionWarnings("foo-bar", ["foo-bar"]), []);
});

test("web identity derives plugin type and component files", () => {
  const single = deriveWebIdentity({
    id: "date-range",
    hooks: ["query-filter"],
    apiVersion: "1.0",
  });

  assert.equal(single.pluginType, "query-filter");
  assert.equal(single.entry, "index.ts");
  assert.deepEqual(single.components, [
    {
      hook: "query-filter",
      className: "DateRangeFilter",
      file: "DateRangeFilter.tsx",
    },
  ]);

  const multi = deriveWebIdentity({
    id: "study-tools",
    hooks: ["route", "sidebar-menu", "settings"],
    apiVersion: "1.0",
  });

  assert.equal(multi.pluginType, "multi");
  assert.deepEqual(
    multi.components.map((entry) => entry.file),
    ["StudyToolsPage.tsx", "StudyToolsSettings.tsx"],
  );

  const override = deriveWebIdentity({
    id: "study-tools",
    hooks: ["route"],
    typeOverride: "custom",
    apiVersion: "1.0",
  });

  assert.equal(override.pluginType, "custom");

  const settings = deriveWebIdentity({
    id: "my-settings",
    hooks: ["settings"],
    apiVersion: "1.0",
  });
  assert.equal(settings.components[0].className, "MySettings");
  assert.equal(settings.components[0].file, "MySettings.tsx");
});
