import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { main } from "../src/cli.mjs";
import { EXIT_CODES } from "../src/errors.mjs";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-java-project-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
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

async function newProject(root, id = "my-project") {
  const result = await run([
    "init",
    "--id",
    id,
    "--out",
    root,
  ]);
  assert.equal(result.code, EXIT_CODES.OK, result.stderr);
}

test("java --project writes the module and registers it in the root POM", async (t) => {
  const root = path.join(tempDir(t), "project");
  await newProject(root);

  const result = await run([
    "java",
    "--id",
    "my-store",
    "--family",
    "storage",
    "--readable",
    "--project",
    root,
  ]);

  assert.equal(result.code, EXIT_CODES.OK, result.stderr);

  const moduleDir = path.join(
    root,
    "plugins",
    "dicoogle-next-storage-my-store",
  );
  assert.ok(existsSync(path.join(moduleDir, "pom.xml")));

  const pluginPom = readFileSync(path.join(moduleDir, "pom.xml"), "utf8");
  assert.match(pluginPom, /<relativePath\/>/);
  assert.doesNotMatch(pluginPom, /<relativePath>\.\.\/\.\.\/pom\.xml<\/relativePath>/);

  const rootPom = readFileSync(path.join(root, "pom.xml"), "utf8");
  assert.match(
    rootPom,
    /<module>plugins\/dicoogle-next-storage-my-store<\/module>/,
  );
});

test("java --project --dry-run writes nothing and leaves the root POM alone", async (t) => {
  const root = path.join(tempDir(t), "project");
  await newProject(root);
  const before = readFileSync(path.join(root, "pom.xml"), "utf8");

  const result = await run([
    "java",
    "--id",
    "dry-store",
    "--family",
    "storage",
    "--readable",
    "--project",
    root,
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK, result.stderr);
  assert.match(result.stdout, /dicoogle-next-storage-dry-store\//);

  assert.equal(
    existsSync(
      path.join(root, "plugins", "dicoogle-next-storage-dry-store"),
    ),
    false,
  );
  assert.equal(readFileSync(path.join(root, "pom.xml"), "utf8"), before);
});

test("java --project fails clearly when the project root is missing", async (t) => {
  const missing = path.join(tempDir(t), "missing-project");

  const result = await run([
    "java",
    "--id",
    "missing-store",
    "--family",
    "storage",
    "--readable",
    "--project",
    missing,
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /project root not found/);
});

test("java warns when the package is outside org.dicoogle", async (t) => {
  const root = path.join(tempDir(t), "project");
  await newProject(root);

  const result = await run([
    "java",
    "--id",
    "outside-store",
    "--family",
    "storage",
    "--readable",
    "--package",
    "com.example.store",
    "--project",
    root,
  ]);

  assert.equal(result.code, EXIT_CODES.OK, result.stderr);
  assert.match(result.stderr, /outside org\.dicoogle/);
  assert.match(result.stderr, /will not be discovered/);

  const pluginPom = readFileSync(
    path.join(
      root,
      "plugins",
      "dicoogle-next-storage-outside-store",
      "pom.xml",
    ),
    "utf8",
  );
  assert.match(pluginPom, /<relativePath\/>/);
});

test("java without --project keeps the in-repo/standalone parent behavior", async (t) => {
  const out = path.join(
    tempDir(t),
    "dicoogle-next-storage-regression",
  );

  const result = await run([
    "java",
    "--id",
    "regression",
    "--family",
    "storage",
    "--readable",
    "--out",
    out,
  ]);

  assert.equal(result.code, EXIT_CODES.OK, result.stderr);

  const pluginPom = readFileSync(path.join(out, "pom.xml"), "utf8");
  assert.match(
    pluginPom,
    /<relativePath>\.\.\/\.\.\/pom\.xml<\/relativePath>/,
  );
  assert.equal(existsSync(path.join(path.dirname(out), "pom.xml")), false);
});
