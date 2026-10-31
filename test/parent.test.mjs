import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { main } from "../src/cli.mjs";
import { EXIT_CODES } from "../src/errors.mjs";
import { loadLock } from "../src/lock.mjs";
import { inspectParentPom } from "../src/parent.mjs";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-parent-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeParentPom(directory, coordinates) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "pom.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>${coordinates.groupId}</groupId>
  <artifactId>${coordinates.artifactId}</artifactId>
  <version>${coordinates.version}</version>
  <packaging>pom</packaging>
</project>
`,
  );
}

async function run(argv) {
  let stdout = "";
  let stderr = "";
  const code = await main(argv, {
    stdout: {
      write(chunk) {
        stdout += String(chunk);
      },
    },
    stderr: {
      write(chunk) {
        stderr += String(chunk);
      },
    },
  });
  return { code, stdout, stderr };
}

test("in-repo target recognises the pinned parent POM", (t) => {
  const lock = loadLock();
  const pin = lock.dicoogleNext;
  const root = tempDir(t);
  const out = path.join(root, "backend", "plugins", "my-store");

  mkdirSync(out, { recursive: true });
  writeParentPom(path.join(root, "backend"), {
    groupId: pin.parentGroupId,
    artifactId: pin.parentArtifactId,
    version: pin.parentVersion,
  });

  const result = inspectParentPom({ out, lock });

  assert.equal(result.mode, "in-repo");
  assert.equal(result.groupId, pin.parentGroupId);
  assert.equal(result.artifactId, pin.parentArtifactId);
  assert.equal(result.version, pin.parentVersion);
});

test("missing ../../pom.xml means standalone mode", (t) => {
  const root = tempDir(t);
  const out = path.join(root, "standalone", "my-store");
  const result = inspectParentPom({ out, lock: loadLock() });

  assert.equal(result.mode, "standalone");
  assert.equal(result.parentPath, null);
});

test("conflicting parent POM exits 2", (t) => {
  const root = tempDir(t);
  const out = path.join(root, "backend", "plugins", "my-store");

  mkdirSync(out, { recursive: true });
  writeParentPom(path.join(root, "backend"), {
    groupId: "com.example",
    artifactId: "wrong-parent",
    version: "9.9.9",
  });

  assert.throws(
    () => inspectParentPom({ out, lock: loadLock() }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /conflicting parent POM/.test(error.message),
  );
});

test("dry-run surfaces a conflicting parent POM before writing", async (t) => {
  const root = tempDir(t);
  const out = path.join(root, "backend", "plugins", "my-store");

  writeParentPom(path.join(root, "backend"), {
    groupId: "com.example",
    artifactId: "wrong-parent",
    version: "9.9.9",
  });

  const result = await run([
    "java",
    "--id",
    "my-store",
    "--family",
    "storage",
    "--readable",
    "--out",
    out,
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /conflicting parent POM/);
  assert.equal(result.stdout, "");
});

test("conflicting parent POM exits 2 and leaves the target untouched", async (t) => {
  const root = tempDir(t);
  const out = path.join(root, "backend", "plugins", "my-store");
  const keep = path.join(out, "keep.txt");

  mkdirSync(out, { recursive: true });
  writeFileSync(keep, "keep\n");
  writeParentPom(path.join(root, "backend"), {
    groupId: "com.example",
    artifactId: "wrong-parent",
    version: "9.9.9",
  });

  const before = readdirSync(out).sort();
  const result = await run([
    "java",
    "--id",
    "my-store",
    "--family",
    "storage",
    "--readable",
    "--out",
    out,
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /conflicting parent POM/);
  assert.equal(result.stdout, "");
  assert.deepEqual(readdirSync(out).sort(), before);
  assert.equal(readFileSync(keep, "utf8"), "keep\n");
  assert.equal(existsSync(path.join(out, "pom.xml")), false);
});
