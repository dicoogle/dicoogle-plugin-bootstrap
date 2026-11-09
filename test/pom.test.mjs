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

import { EXIT_CODES } from "../src/errors.mjs";
import {
  addModuleToProjectPom,
  inspectProjectPom,
} from "../src/pom.mjs";
import { loadLock } from "../src/lock.mjs";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-pom-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writePom(t, content) {
  const dir = tempDir(t);
  const pom = path.join(dir, "pom.xml");
  writeFileSync(pom, content, "utf8");
  return pom;
}

function projectPom({ modules = true, eol = "\n" } = {}) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<project>",
    "    <modelVersion>4.0.0</modelVersion>",
    "    <groupId>com.example</groupId>",
    "    <artifactId>plugins</artifactId>",
    "    <version>0.0.1-SNAPSHOT</version>",
    "    <packaging>pom</packaging>",
    ...(modules
      ? [
          "    <modules>",
          "        <module>plugins/one</module>",
          "    </modules>",
        ]
      : []),
    "</project>",
    "",
  ].join(eol);
}

test("addModuleToProjectPom inserts before </modules> and preserves indentation", (t) => {
  const pom = writePom(t, projectPom());

  const result = addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/two",
  });

  assert.equal(result.changed, true);
  assert.equal(result.module, "plugins/two");

  const content = readFileSync(pom, "utf8");
  assert.match(
    content,
    /    <modules>\n        <module>plugins\/one<\/module>\n        <module>plugins\/two<\/module>\n    <\/modules>/,
  );
});

test("addModuleToProjectPom is idempotent", (t) => {
  const pom = writePom(t, projectPom());

  const first = addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/two",
  });
  const afterFirst = readFileSync(pom, "utf8");
  const second = addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/two",
  });

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(readFileSync(pom, "utf8"), afterFirst);
});

test("addModuleToProjectPom creates a missing modules block", (t) => {
  const pom = writePom(t, projectPom({ modules: false }));

  addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/new-module",
  });

  const content = readFileSync(pom, "utf8");
  assert.match(
    content,
    /    <modules>\n        <module>plugins\/new-module<\/module>\n    <\/modules>\n<\/project>/,
  );
});

test("addModuleToProjectPom replaces a self-closing modules block", (t) => {
  const pom = writePom(
    t,
    projectPom({ modules: false }).replace(
      "    <packaging>pom</packaging>",
      "    <packaging>pom</packaging>\n    <modules/>",
    ),
  );

  addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/self-closing",
  });

  const content = readFileSync(pom, "utf8");
  assert.match(
    content,
    /    <modules>\n        <module>plugins\/self-closing<\/module>\n    <\/modules>/,
  );
  assert.doesNotMatch(content, /<modules\/>/);
});

test("addModuleToProjectPom preserves CRLF line endings", (t) => {
  const pom = writePom(t, projectPom({ eol: "\r\n" }));

  addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/crlf",
  });

  const content = readFileSync(pom, "utf8");
  assert.ok(content.includes("\r\n"));
  assert.equal(/(^|[^\r])\n/.test(content), false);
});

test("addModuleToProjectPom XML-escapes the module path", (t) => {
  const pom = writePom(t, projectPom());

  addModuleToProjectPom({
    projectPom: pom,
    module: "plugins/a&b",
  });

  const content = readFileSync(pom, "utf8");
  assert.match(content, /<module>plugins\/a&amp;b<\/module>/);
  assert.doesNotMatch(content, /<module>plugins\/a&b<\/module>/);
});

test("addModuleToProjectPom fails clearly for missing and non-pom POMs", (t) => {
  assert.throws(
    () =>
      addModuleToProjectPom({
        projectPom: path.join(tempDir(t), "pom.xml"),
        module: "plugins/x",
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /project POM not found/.test(error.message),
  );

  const pom = writePom(
    t,
    projectPom().replace(
      "<packaging>pom</packaging>",
      "<packaging>jar</packaging>",
    ),
  );

  assert.throws(
    () =>
      addModuleToProjectPom({
        projectPom: pom,
        module: "plugins/x",
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /not a pom-packaging project/.test(error.message),
  );
});

test("inspectProjectPom validates the project parent", (t) => {
  const pin = loadLock().dicoogleNext;
  const dir = tempDir(t);
  const pom = path.join(dir, "pom.xml");

  writeFileSync(
    pom,
    `<?xml version="1.0" encoding="UTF-8"?>
<project>
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>${pin.parentGroupId}</groupId>
        <artifactId>${pin.parentArtifactId}</artifactId>
        <version>${pin.parentVersion}</version>
        <relativePath/>
    </parent>
    <groupId>com.example</groupId>
    <artifactId>plugins</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <packaging>pom</packaging>
</project>
`,
  );

  const result = inspectProjectPom({ project: dir, lock: loadLock() });
  assert.equal(result.projectRoot, dir);
  assert.equal(result.projectPom, pom);

  writeFileSync(
    pom,
    readFileSync(pom, "utf8").replace(
      "<artifactId>" + pin.parentArtifactId + "</artifactId>",
      "<artifactId>wrong-parent</artifactId>",
    ),
  );

  assert.throws(
    () => inspectProjectPom({ project: dir, lock: loadLock() }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /project POM parent mismatch/.test(error.message),
  );
});
