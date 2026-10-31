import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { formatDryRunTree } from "../src/fs.mjs";
import { loadLock } from "../src/lock.mjs";
import {
  buildListenerPlan,
  materializePlan,
} from "../src/plan.mjs";
import { LISTENER_CASES, listenerModel } from "./helpers.mjs";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "listener",
);

function fixture(name) {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("listener plans have the expected ordered file tree", () => {
  for (const [name, flags, values = {}] of LISTENER_CASES) {
    const model = listenerModel(flags, values);
    const plan = buildListenerPlan(model, loadLock());

    assert.deepEqual(
      plan.files.map((file) => file.path),
      [
        "pom.xml",
        "README.md",
        `src/main/java/${model.packagePath}/${model.className}.java`,
        `src/main/java/${model.packagePath}/${model.className}Config.java`,
        `src/main/java/${model.packagePath}/${model.className}Properties.java`,
        `src/test/java/${model.packagePath}/${model.className}Test.java`,
      ],
      name,
    );
  }
});

test("listener dry-run tree snapshots match for every case", (t) => {
  const tempParent = mkdtempSync(
    path.join(tmpdir(), "dicoogle-l-tree-"),
  );
  t.after(() => rmSync(tempParent, { recursive: true, force: true }));

  for (const [name, flags, values = {}] of LISTENER_CASES) {
    const model = listenerModel(flags, values);
    const plan = buildListenerPlan(model, loadLock());
    const tree = formatDryRunTree({
      out: path.join(tempParent, model.artifactId),
      files: plan.files,
    });

    assert.equal(tree, fixture(`${name}.tree.txt`), name);
  }
});

test("composed listener class snapshots match for every case", () => {
  for (const [name, flags, values = {}] of LISTENER_CASES) {
    const model = listenerModel(flags, values);
    const plan = buildListenerPlan(model, loadLock());
    const files = materializePlan(plan);
    const mainClass = files.find((file) =>
      file.path.endsWith(`/${model.className}.java`),
    );

    assert.ok(mainClass, name);
    assert.equal(mainClass.content, fixture(`${name}.java`), name);
  }
});

test("listener materialized plans are complete and token-free", () => {
  for (const [name, flags, values = {}] of LISTENER_CASES) {
    const model = listenerModel(flags, values);
    const plan = buildListenerPlan(model, loadLock());
    const files = materializePlan(plan);

    assert.equal(files.length, 6, name);

    for (const file of files) {
      assert.ok(!file.content.includes("{{"), file.path);
      assert.ok(!file.content.includes("}}"), file.path);
      assert.ok(file.content.endsWith("\n"), file.path);
    }

    const testFile = files.find((file) =>
      file.path.endsWith(`${model.className}Test.java`),
    );
    const pom = files.find((file) => file.path === "pom.xml");

    assert.ok(testFile, name);
    assert.match(testFile.content, /ApplicationContextRunner/);
    assert.match(testFile.content, /registersBeanWhenEnabled/);
    assert.match(testFile.content, /registersNothingWhenDisabled/);
    assert.match(testFile.content, /registersNothingByDefault/);

    assert.ok(pom, name);
    assert.match(pom.content, /<artifactId>spring-boot-test<\/artifactId>/);
    assert.match(pom.content, /<artifactId>assertj-core<\/artifactId>/);
  }
});

test("listener READMEs state the exact event scope with code references", () => {
  const ingestModel = listenerModel({ ingest: true });
  const ingestFiles = materializePlan(
    buildListenerPlan(ingestModel, loadLock()),
  );
  const ingestReadme = ingestFiles.find((file) => file.path === "README.md");

  assert.ok(ingestReadme);
  assert.match(ingestReadme.content, /only from DIMSE C-STORE/);
  assert.match(ingestReadme.content, /CStoreService\.java:364/);
  assert.match(ingestReadme.content, /CStoreService\.java:382/);
  assert.match(ingestReadme.content, /DICOMweb STOW does not invoke it/);

  const retrieveModel = listenerModel({ retrieve: true });
  const retrieveFiles = materializePlan(
    buildListenerPlan(retrieveModel, loadLock()),
  );
  const retrieveReadme = retrieveFiles.find((file) => file.path === "README.md");

  assert.ok(retrieveReadme);
  assert.match(retrieveReadme.content, /only from DICOMweb retrieval/);
  assert.match(retrieveReadme.content, /DicomwebRetrieveService\.java:369/);
  assert.match(retrieveReadme.content, /DicomwebRetrieveService\.java:382/);
  assert.match(retrieveReadme.content, /DIMSE C-MOVE does not invoke it/);
});

test("listener context tests assert the consumed list type and absence of the other", () => {
  const ingestModel = listenerModel({ ingest: true });
  const ingestTest = materializePlan(
    buildListenerPlan(ingestModel, loadLock()),
  ).find((file) => file.path.endsWith(`${ingestModel.className}Test.java`));

  assert.ok(ingestTest);
  assert.match(ingestTest.content, /getBeansOfType\(StorageIngestEventListener\.class\)/);
  assert.match(ingestTest.content, /getBeansOfType\(StorageRetrieveEventListener\.class\)\.isEmpty/);

  const retrieveModel = listenerModel({ retrieve: true });
  const retrieveTest = materializePlan(
    buildListenerPlan(retrieveModel, loadLock()),
  ).find((file) => file.path.endsWith(`${retrieveModel.className}Test.java`));

  assert.ok(retrieveTest);
  assert.match(retrieveTest.content, /getBeansOfType\(StorageRetrieveEventListener\.class\)/);
  assert.match(retrieveTest.content, /getBeansOfType\(StorageIngestEventListener\.class\)\.isEmpty/);
});

test("listener long-id output stays within 100 columns", () => {
  const model = listenerModel(
    { ingest: true },
    { id: "fixture-listener-ingest-long-identifier" },
  );
  const mainClass = materializePlan(
    buildListenerPlan(model, loadLock()),
  ).find((file) => file.path.endsWith(`/${model.className}.java`));

  assert.ok(mainClass);
  assert.ok(
    mainClass.content.split("\n").every((line) => line.length <= 100),
  );
});


test("listener callbacks are exception-safe and documented", () => {
  for (const kind of ["ingest", "retrieve"]) {
    const model = listenerModel({ [kind]: true });
    const files = materializePlan(
      buildListenerPlan(model, loadLock()),
    );
    const testFile = files.find((file) =>
      file.path.endsWith(`${model.className}Test.java`),
    );
    const readme = files.find((file) => file.path === "README.md");

    assert.ok(testFile, kind);
    assert.match(
      testFile.content,
      /callbacksDoNotRethrowInternalFailures/,
      kind,
    );

    assert.ok(readme, kind);
    assert.match(readme.content, /Callback safety/, kind);
    assert.match(readme.content, /never rethrows/, kind);

    if (kind === "ingest") {
      assert.match(readme.content, /CStoreService\.java:364/, kind);
      assert.match(readme.content, /CStoreService\.java:233-248/, kind);
    } else {
      assert.match(
        readme.content,
        /DicomwebRetrieveService\.java:369/,
        kind,
      );
    }
  }
});
