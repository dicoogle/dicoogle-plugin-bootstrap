import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXIT_CODES } from "../src/errors.mjs";
import { formatDryRunTree } from "../src/fs.mjs";
import { loadLock } from "../src/lock.mjs";
import {
  buildStoragePlan,
  escapeXml,
  materializePlan,
} from "../src/plan.mjs";
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


test("POM output escapes XML special characters", () => {
  const model = storageModel(
    { readable: true },
    {
      name: `A & B <C> "D" 'E'`,
      description: `F & G <H> "I" 'J'`,
    },
  );
  const files = materializePlan(buildStoragePlan(model, loadLock()));
  const pom = files.find((file) => file.path === "pom.xml");

  assert.ok(pom);
  assert.ok(
    pom.content.includes(
      "<name>A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;</name>",
    ),
    pom.content,
  );
  assert.ok(
    pom.content.includes(
      "<description>F &amp; G &lt;H&gt; &quot;I&quot; &apos;J&apos;</description>",
    ),
    pom.content,
  );
});

test("escapeXml escapes the five XML-sensitive characters", () => {
  assert.equal(
    escapeXml(`& < > " '`),
    "&amp; &lt; &gt; &quot; &apos;",
  );
});

test("generated tests include enabled and default Spring context checks", () => {
  const model = storageModel({ readable: true });
  const files = materializePlan(buildStoragePlan(model, loadLock()));
  const testFile = files.find((file) =>
    file.path.endsWith(`${model.className}Test.java`),
  );
  const pom = files.find((file) => file.path === "pom.xml");

  assert.ok(testFile);
  assert.match(testFile.content, /ApplicationContextRunner/);
  assert.match(testFile.content, /registersBeanWhenEnabled/);
  assert.match(testFile.content, /registersNothingByDefault/);
  assert.match(
    testFile.content,
    /withPropertyValues\("app\.storage\.my-store\.enabled=true"\)/,
  );
  assert.match(testFile.content, /getBeansOfType\(MyStoreStoragePlugin\.class\)/);

  assert.ok(pom);
  assert.match(pom.content, /<artifactId>spring-boot-test<\/artifactId>/);
  assert.match(pom.content, /<artifactId>assertj-core<\/artifactId>/);
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

test("materializePlan surfaces render errors with exit 5", (t) => {
  const templatesDir = mkdtempSync(
    path.join(tmpdir(), "dicoogle-plan-render-"),
  );
  t.after(() => rmSync(templatesDir, { recursive: true, force: true }));
  writeFileSync(path.join(templatesDir, "bad.tmpl"), "{{missing}}\n");

  const plan = {
    root: "unused",
    model: storageModel({ readable: true }),
    files: [
      {
        path: "README.md",
        kind: "template",
        template: "bad.tmpl",
        data: {},
      },
    ],
  };

  assert.throws(
    () => materializePlan(plan, { templatesDir }),
    (error) => error.exitCode === EXIT_CODES.TEMPLATE,
  );
});
