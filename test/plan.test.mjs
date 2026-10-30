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
import { buildStoragePlan, materializePlan } from "../src/plan.mjs";
import { STORAGE_CASES, storageModel } from "./helpers.mjs";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "storage",
);

function fixture(name) {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("storage plans have the expected ordered file tree", () => {
  for (const [name, flags] of STORAGE_CASES) {
    const model = storageModel(flags);
    const plan = buildStoragePlan(model, loadLock());

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

test("dry-run tree snapshots match for every storage capability case", (t) => {
  const tempParent = mkdtempSync(
    path.join(tmpdir(), "dicoogle-plan-tree-"),
  );
  t.after(() => rmSync(tempParent, { recursive: true, force: true }));

  for (const [name, flags] of STORAGE_CASES) {
    const model = storageModel(flags);
    const plan = buildStoragePlan(model, loadLock());
    const tree = formatDryRunTree({
      out: path.join(tempParent, model.artifactId),
      files: plan.files,
    });

    assert.equal(tree, fixture(`${name}.tree.txt`), name);
  }
});

test("composed storage class snapshots match for every capability case", () => {
  for (const [name, flags] of STORAGE_CASES) {
    const model = storageModel(flags);
    const plan = buildStoragePlan(model, loadLock());
    const files = materializePlan(plan);
    const mainClass = files.find((file) =>
      file.path.endsWith(`/${model.className}.java`),
    );

    assert.ok(mainClass, name);
    assert.equal(mainClass.content, fixture(`${name}.java`), name);
  }
});

test("materialized storage plans are complete and token-free", () => {
  for (const [name, flags] of STORAGE_CASES) {
    const model = storageModel(flags);
    const plan = buildStoragePlan(model, loadLock());
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

    assert.ok(testFile, name);
    assert.match(testFile.content, /class MyStoreStoragePluginTest/);
    assert.match(testFile.content, /@TempDir Path tempDir;/);
  }
});
