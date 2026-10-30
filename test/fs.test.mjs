import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import {
  TargetError,
  formatDryRunTree,
  inspectTarget,
  writePlan,
} from "../src/fs.mjs";

const FILES = [
  { path: "pom.xml", content: "<project />\n" },
  {
    path: "src/main/java/org/example/Example.java",
    content: "package org.example;\n",
  },
];

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-fs-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("non-empty target exits 3 without --force", (t) => {
  const dir = tempDir(t);
  writeFileSync(path.join(dir, "existing.txt"), "keep\n");

  assert.throws(
    () => writePlan({ out: dir, files: FILES }),
    (error) =>
      error instanceof TargetError &&
      error.exitCode === EXIT_CODES.TARGET_NOT_EMPTY,
  );

  assert.throws(
    () => formatDryRunTree({ out: dir, files: FILES }),
    (error) =>
      error instanceof TargetError &&
      error.exitCode === EXIT_CODES.TARGET_NOT_EMPTY,
  );
});

test("--force writes planned files without deleting unrelated files", (t) => {
  const dir = tempDir(t);
  writeFileSync(path.join(dir, "existing.txt"), "keep\n");
  writeFileSync(path.join(dir, "pom.xml"), "old\n");

  const result = writePlan({ out: dir, files: FILES, force: true });

  assert.equal(result.root, path.resolve(dir));
  assert.equal(
    readFileSync(path.join(dir, "pom.xml"), "utf8"),
    "<project />\n",
  );
  assert.equal(
    readFileSync(path.join(dir, "existing.txt"), "utf8"),
    "keep\n",
  );
  assert.ok(
    existsSync(
      path.join(
        dir,
        "src/main/java/org/example/Example.java",
      ),
    ),
  );
});

test("dry-run writes nothing, including no temporary directories", (t) => {
  const parent = tempDir(t);
  const out = path.join(parent, "new-plugin");

  const tree = formatDryRunTree({ out, files: FILES });

  assert.equal(
    tree,
    "new-plugin/\n" +
      "  pom.xml\n" +
      "  src/main/java/org/example/Example.java\n",
  );
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(parent), []);
});

test("regular-file --out is refused", (t) => {
  const dir = tempDir(t);
  const file = path.join(dir, "not-a-directory");
  writeFileSync(file, "x\n");

  assert.throws(
    () => writePlan({ out: file, files: FILES }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /refusing to use a regular file/.test(error.message),
  );
});

test("filesystem root --out is refused", () => {
  assert.throws(
    () => inspectTarget({ out: "/" }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /filesystem root/.test(error.message),
  );
});

test("symlink components inside --out are refused", (t) => {
  const parent = tempDir(t);
  const out = path.join(parent, "out");
  const outside = path.join(parent, "outside");
  mkdirSync(out);
  mkdirSync(outside);
  symlinkSync(outside, path.join(out, "link"), "dir");

  assert.throws(
    () =>
      writePlan({
        out,
        files: [{ path: "link/evil.txt", content: "x\n" }],
        force: true,
      }),
    (error) =>
      error.exitCode === EXIT_CODES.USAGE &&
      /symlink/.test(error.message),
  );
});

test("new --out is created only when writing", (t) => {
  const parent = tempDir(t);
  const out = path.join(parent, "new-plugin");

  const result = writePlan({ out, files: FILES });

  assert.equal(result.root, path.resolve(out));
  assert.ok(existsSync(out));
  assert.equal(readdirSync(out).length, 2);
});
