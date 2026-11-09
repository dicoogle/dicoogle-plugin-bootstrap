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
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-project-"));
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

test("init creates the project root POM, gitignore, and README", async (t) => {
  const out = path.join(tempDir(t), "my-project");

  const result = await run([
    "init",
    "--id",
    "my-project",
    "--name",
    "My Project",
    "--group-id",
    "org.example",
    "--version",
    "1.2.3",
    "--out",
    out,
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /created 3 file\(s\)/);

  const pom = readFileSync(path.join(out, "pom.xml"), "utf8");
  assert.match(
    pom,
    /<parent>\s*<groupId>org\.dicoogle<\/groupId>\s*<artifactId>dicoogle-next-backend-parent<\/artifactId>\s*<version>0\.0\.1-SNAPSHOT<\/version>\s*<relativePath\/>/,
  );
  assert.match(pom, /<groupId>org\.example<\/groupId>/);
  assert.match(pom, /<artifactId>my-project<\/artifactId>/);
  assert.match(pom, /<version>1\.2\.3<\/version>/);
  assert.match(pom, /<packaging>pom<\/packaging>/);
  assert.match(pom, /<modules>\s*<\/modules>/);

  assert.ok(existsSync(path.join(out, ".gitignore")));
  assert.ok(existsSync(path.join(out, "README.md")));

  const readme = readFileSync(path.join(out, "README.md"), "utf8");
  assert.match(readme, /--project \./);
  assert.match(readme, /PropertiesLauncher/);
  assert.match(readme, /verified against dicoogle-next/);
});

test("init --dry-run writes nothing", async (t) => {
  const out = path.join(tempDir(t), "dry-project");

  const result = await run([
    "init",
    "--id",
    "dry-project",
    "--out",
    out,
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /pom\.xml/);
  assert.equal(existsSync(out), false);
});

test("init validates group id and version", async (t) => {
  const out = path.join(tempDir(t), "bad-project");

  const badGroup = await run([
    "init",
    "--id",
    "bad-project",
    "--group-id",
    "Not A Group",
    "--out",
    out,
  ]);

  assert.equal(badGroup.code, EXIT_CODES.USAGE);
  assert.match(badGroup.stderr, /invalid --group-id/);
  assert.equal(existsSync(out), false);

  const badVersion = await run([
    "init",
    "--id",
    "bad-project",
    "--version",
    "one",
    "--out",
    out,
  ]);

  assert.equal(badVersion.code, EXIT_CODES.USAGE);
  assert.match(badVersion.stderr, /invalid --version/);
  assert.equal(existsSync(out), false);
});
