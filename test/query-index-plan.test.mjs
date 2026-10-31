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

import { EXIT_CODES } from "../src/errors.mjs";
import { formatDryRunTree } from "../src/fs.mjs";
import { loadLock } from "../src/lock.mjs";
import {
  buildQueryIndexPlan,
  materializePlan,
} from "../src/plan.mjs";
import {
  QUERY_INDEX_CASES,
  queryIndexModel,
} from "./helpers.mjs";

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "query-index",
);

function fixture(name) {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("query-index plans have the expected ordered file tree", () => {
  for (const [name, flags, values = {}] of QUERY_INDEX_CASES) {
    const model = queryIndexModel(flags, values);
    const plan = buildQueryIndexPlan(model, loadLock());

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

test("query-index dry-run tree snapshots match for every case", (t) => {
  const tempParent = mkdtempSync(
    path.join(tmpdir(), "dicoogle-q-tree-"),
  );
  t.after(() => rmSync(tempParent, { recursive: true, force: true }));

  for (const [name, flags, values = {}] of QUERY_INDEX_CASES) {
    const model = queryIndexModel(flags, values);
    const plan = buildQueryIndexPlan(model, loadLock());
    const tree = formatDryRunTree({
      out: path.join(tempParent, model.artifactId),
      files: plan.files,
    });

    assert.equal(tree, fixture(`${name}.tree.txt`), name);
  }
});

test("composed query-index class snapshots match for every case", () => {
  for (const [name, flags, values = {}] of QUERY_INDEX_CASES) {
    const model = queryIndexModel(flags, values);
    const plan = buildQueryIndexPlan(model, loadLock());
    const files = materializePlan(plan);
    const mainClass = files.find((file) =>
      file.path.endsWith(`/${model.className}.java`),
    );

    assert.ok(mainClass, name);
    assert.equal(mainClass.content, fixture(`${name}.java`), name);
  }
});

test("query-index materialized plans are complete and token-free", () => {
  for (const [name, flags, values = {}] of QUERY_INDEX_CASES) {
    const model = queryIndexModel(flags, values);
    const plan = buildQueryIndexPlan(model, loadLock());
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
    assert.match(pom.content, /<artifactId>dcm4che-core<\/artifactId>/);
  }
});

test("query-index capability context tests reference consumed list types", () => {
  const cases = [
    ["ingest", /getBeansOfType\(StorageIngestEventListener\.class\)/],
    ["query", /getBeansOfType\(QueryService\.class\)/],
    ["move", /getBeansOfType\(QueryMoveService\.class\)/],
    ["maintenance", /getBeansOfType\(QueryIndexMaintenance\.class\)/],
    ["settings", /getBeansOfType\(QueryIndexSettings\.class\)/],
  ];

  for (const [name, pattern] of cases) {
    const model = queryIndexModel({ [name]: true });
    const plan = buildQueryIndexPlan(model, loadLock());
    const testFile = materializePlan(plan).find((file) =>
      file.path.endsWith(`${model.className}Test.java`),
    );

    assert.ok(testFile, name);
    assert.match(testFile.content, pattern, name);
  }
});

test("query-index maintenance indexId defaults to the plugin id", () => {
  const model = queryIndexModel({ maintenance: true });
  const files = materializePlan(
    buildQueryIndexPlan(model, loadLock()),
  );
  const mainClass = files.find((file) =>
    file.path.endsWith(`/${model.className}.java`),
  );

  assert.ok(mainClass);
  assert.match(
    mainClass.content,
    /public String indexId\(\) \{\n    return "my-index";\n  \}/,
  );
});

test("query-index XML escaping is applied to the POM", () => {
  const model = queryIndexModel(
    { ingest: true },
    {
      name: `A & B <C> "D" 'E'`,
      description: `F & G <H> "I" 'J'`,
    },
  );
  const files = materializePlan(
    buildQueryIndexPlan(model, loadLock()),
  );
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


test("settings generation warns about IndexSettingsController displacement", () => {
  const settingsModel = queryIndexModel({ settings: true });
  const settingsFiles = materializePlan(
    buildQueryIndexPlan(settingsModel, loadLock()),
  );
  const settingsReadme = settingsFiles.find(
    (file) => file.path === "README.md",
  );

  assert.ok(settingsReadme);
  assert.match(settingsReadme.content, /IndexSettingsController/);
  assert.match(settingsReadme.content, /selects the \*\*first\*\*/);
  assert.match(settingsReadme.content, /Only that first provider is exposed/);

  const ingestFiles = materializePlan(
    buildQueryIndexPlan(queryIndexModel({ ingest: true }), loadLock()),
  );
  const ingestReadme = ingestFiles.find(
    (file) => file.path === "README.md",
  );

  assert.ok(ingestReadme);
  assert.doesNotMatch(ingestReadme.content, /IndexSettingsController/);
});

test("query-index tests assert lifecycle start/stop exactly once", () => {
  const model = queryIndexModel({ query: true });
  const files = materializePlan(
    buildQueryIndexPlan(model, loadLock()),
  );
  const testFile = files.find((file) =>
    file.path.endsWith(`${model.className}Test.java`),
  );

  assert.ok(testFile);
  assert.match(testFile.content, /lifecycleRunsOnce/);
  assert.match(testFile.content, /assertEquals\(1, plugin\.startCount\(\)\)/);
  assert.match(testFile.content, /context\.close\(\)/);
  assert.match(testFile.content, /assertEquals\(1, plugin\.stopCount\(\)\)/);
});

test("long-id case wraps a long class name within 100 columns", () => {
  const model = queryIndexModel(
    {
      ingest: true,
      query: true,
      move: true,
      maintenance: true,
      settings: true,
    },
    { id: "fixture-query-index-long-ident" },
  );
  const files = materializePlan(
    buildQueryIndexPlan(model, loadLock()),
  );
  const mainClass = files.find((file) =>
    file.path.endsWith(`/${model.className}.java`),
  );

  assert.ok(mainClass);
  assert.ok(model.className.length >= 40);
  assert.ok(
    mainClass.content
      .split("\n")
      .every((line) => line.length <= 100),
    "expected GJF-compatible lines no longer than 100 columns",
  );
});

test("query-index materialize surfaces render errors with exit 5", (t) => {
  const templatesDir = mkdtempSync(
    path.join(tmpdir(), "dicoogle-q-render-"),
  );
  t.after(() => rmSync(templatesDir, { recursive: true, force: true }));

  const plan = {
    root: "unused",
    model: queryIndexModel({ ingest: true }),
    files: [
      {
        path: "README.md",
        kind: "query-index-test",
        data: {},
      },
    ],
  };

  assert.throws(
    () => materializePlan(plan, { templatesDir }),
    (error) => error.exitCode === EXIT_CODES.TEMPLATE,
  );
});


test("query-index stubs are safe and documented", () => {
  const model = queryIndexModel({
    ingest: true,
    query: true,
    move: true,
    maintenance: true,
  });
  const files = materializePlan(
    buildQueryIndexPlan(model, loadLock()),
  );
  const mainClass = files.find((file) =>
    file.path.endsWith(`/${model.className}.java`),
  );
  const testFile = files.find((file) =>
    file.path.endsWith(`${model.className}Test.java`),
  );
  const readme = files.find((file) => file.path === "README.md");

  assert.ok(mainClass);
  assert.match(mainClass.content, /public List<QueryResult> query\(/);
  assert.match(mainClass.content, /return List\.of\(\);/);
  assert.match(mainClass.content, /recorded ingest entries/);
  assert.match(mainClass.content, /recordIngestSuccess/);
  assert.match(mainClass.content, /maintainedPaths/);
  assert.doesNotMatch(
    mainClass.content,
    /for \(IndexEntry entry : index\.values\(\)\)/,
  );

  assert.ok(testFile);
  assert.match(testFile.content, /queryReturnsNoUnmatchedEntries/);
  assert.match(testFile.content, /moveReturnsNoUnmatchedEntries/);
  assert.match(testFile.content, /callbacksDoNotRethrowInternalFailures/);
  assert.match(testFile.content, /maintenanceUsesOnlyItsOwnPathState/);

  assert.ok(readme);
  assert.match(readme.content, /This module is disabled by default/);
  assert.match(readme.content, /## How routing finds your plugin/);
  assert.match(readme.content, /There is no router timeout/);
  assert.match(readme.content, /Provider order is not stable/);
  assert.match(readme.content, /Callback safety/);
  assert.match(readme.content, /Maintenance isolation/);
});
