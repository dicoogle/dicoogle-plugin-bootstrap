import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXIT_CODES } from "../src/errors.mjs";
import {
  TemplateLockError,
  extractPlaceholders,
  loadLock,
  verifyLock,
} from "../src/lock.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = path.join(ROOT, "bin", "dicoogle-plugin-bootstrap.mjs");
const VERIFY_SCRIPT = path.join(
  ROOT,
  "scripts",
  "verify-templates.mjs",
);
const TEMPLATES_DIR = path.join(ROOT, "templates");

function runVerify(args = []) {
  return spawnSync(process.execPath, [VERIFY_SCRIPT, ...args], {
    encoding: "utf8",
  });
}

function makeTempCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-lock-"));
  const templatesDir = path.join(dir, "templates");
  cpSync(TEMPLATES_DIR, templatesDir, { recursive: true });

  return {
    dir,
    templatesDir,
    lockPath: path.join(templatesDir, "lock.json"),
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function mutateLock(temp, mutate) {
  const lock = JSON.parse(readFileSync(temp.lockPath, "utf8"));
  mutate(lock);
  writeFileSync(temp.lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

function firstTemplatePath(lock) {
  return Object.keys(lock.templates)[0];
}

test("real lock verifies and pins the design baseline", () => {
  const { lock, templates } = verifyLock();

  assert.equal(
    lock.dicoogleNext.commit,
    "cdfbff7f601d663453b9b7b77d6d3dc70af1b822",
  );
  assert.equal(
    lock.dicoogleNext.branchAtPin,
    "feat/dissertation-frame-baseline",
  );
  assert.equal(lock.dicoogleNext.javaVersion, "21");
  assert.equal(lock.dicoogleNext.mavenMinimum, "3.9.12");
  assert.equal(lock.dicoogleNext.springBootVersion, "4.0.3");
  assert.equal(lock.dicoogleNext.dcm4cheVersion, "5.34.0");
  assert.equal(lock.dicoogleNext.parentVersion, "0.0.1-SNAPSHOT");
  assert.equal(lock.dicoogleNext.sdkVersion, "0.0.1-SNAPSHOT");
  assert.equal(lock.dicoogleNext.webApiVersion, "1.0");
  assert.equal(lock.listenerIdentities.ingest.domain, "query");
  assert.equal(
    lock.listenerIdentities.ingest.pluginType,
    "query-index",
  );
  assert.equal(
    lock.listenerIdentities.retrieve.domain,
    "service",
  );
  assert.equal(lock.listenerIdentities.retrieve.pluginType, "service");
  assert.ok(templates.length > 0);
});

test("version prints pinned values from the verified lock", () => {
  const result = spawnSync(process.execPath, [BIN, "version"], {
    encoding: "utf8",
  });

  assert.equal(result.status, EXIT_CODES.OK);
  assert.match(
    result.stdout,
    /cdfbff7f601d663453b9b7b77d6d3dc70af1b822/,
  );
  assert.match(result.stdout, /SDK 0\.0\.1-SNAPSHOT/);
  assert.match(result.stdout, /Spring Boot 4\.0\.3/);
  assert.match(result.stdout, /dcm4che 5\.34\.0/);
  assert.match(result.stdout, /web apiVersion 1\.0/);
  assert.equal(result.stderr, "");
});

test("placeholder extraction handles interpolation and blocks", () => {
  const placeholders = extractPlaceholders(
    "id={{id}} name={{ name }} " +
      "{{#if flag}}{{flag}}{{/if}}" +
      "{{#each items}}{{items}}{{/each}}",
  );

  assert.deepEqual(placeholders, ["flag", "id", "items", "name"]);
});

test("verify script passes the real lock", () => {
  const result = runVerify();

  assert.equal(result.status, EXIT_CODES.OK);
  assert.match(result.stdout, /template lock OK/);
  assert.match(result.stdout, /templates verified: [1-9]\d*/);
  assert.equal(result.stderr, "");
});

test("mutated hash exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    const templatePath = firstTemplatePath(lock);
    lock.templates[templatePath].sha256 = "0".repeat(64);
  });

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.match(result.stderr, /template hash mismatch/);
});

test("undeclared placeholder exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    const templatePath = firstTemplatePath(lock);
    lock.templates[templatePath].placeholders =
      lock.templates[templatePath].placeholders.filter(
        (placeholder) => placeholder !== "description",
      );
  });

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.match(
    result.stderr,
    /template uses undeclared placeholder\(s\): .*description/,
  );
});

test("declared-but-unused placeholder exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    const templatePath = firstTemplatePath(lock);
    lock.templates[templatePath].placeholders.push("unusedPlaceholder");
    lock.templates[templatePath].placeholders.sort();
  });

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.match(
    result.stderr,
    /template declares unused placeholder\(s\): .*unusedPlaceholder/,
  );
});

test("missing template file exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  const lock = JSON.parse(readFileSync(temp.lockPath, "utf8"));
  const templatePath = firstTemplatePath(lock);
  unlinkSync(path.join(temp.templatesDir, templatePath));

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.ok(
    result.stderr.includes(`template file missing: ${templatePath}`),
    result.stderr,
  );
});

test("invalid schema exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    lock.schemaVersion = 999;
  });

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.match(result.stderr, /schemaVersion must be 1/);
});

test("listener identity drift exits 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    lock.listenerIdentities.ingest.configPrefix = "app.service.<id>";
  });

  const result = runVerify([
    "--lock",
    temp.lockPath,
    "--templates",
    temp.templatesDir,
  ]);

  assert.equal(result.status, EXIT_CODES.TEMPLATE);
  assert.match(
    result.stderr,
    /listenerIdentities\.ingest\.configPrefix/,
  );
});

test("loadLock throws a TemplateLockError with exit code 5", (t) => {
  const temp = makeTempCopy();
  t.after(() => temp.cleanup());

  mutateLock(temp, (lock) => {
    const templatePath = firstTemplatePath(lock);
    lock.templates[templatePath].sha256 = "0".repeat(64);
  });

  assert.throws(
    () =>
      loadLock({
        lockPath: temp.lockPath,
        templatesDir: temp.templatesDir,
      }),
    (error) =>
      error instanceof TemplateLockError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );
});
