import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXIT_CODES } from "../src/errors.mjs";
import {
  TemplateLockError,
  loadLock,
  validateLock,
} from "../src/lock.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BIN = path.join(ROOT, "bin", "dicoogle-plugin-bootstrap.mjs");

test("real lock pins the design baseline", () => {
  const lock = loadLock();

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
  assert.deepEqual(lock.reservedPluginIds, [
    "lucene",
    "query-file-rw",
    "storage-file-ro",
    "storage-file-rw",
  ]);
  assert.equal(Object.hasOwn(lock, "templates"), false);
});

test("version prints pinned values from the lock", () => {
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

test("lock validation rejects missing pins and duplicates", () => {
  assert.throws(
    () => validateLock({ dicoogleNext: {}, reservedPluginIds: [] }),
    (error) =>
      error instanceof TemplateLockError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );

  const lock = JSON.parse(
    readFileSync(new URL("../templates/lock.json", import.meta.url), "utf8"),
  );

  assert.throws(
    () =>
      validateLock({
        ...lock,
        reservedPluginIds: [...lock.reservedPluginIds, "lucene"],
      }),
    /reservedPluginIds contains duplicate "lucene"/,
  );
});

test("lock read errors use template exit code 5", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-lock-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const missing = path.join(dir, "missing.json");
  assert.throws(
    () => loadLock({ lockPath: missing }),
    (error) =>
      error instanceof TemplateLockError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );

  const invalid = path.join(dir, "invalid.json");
  writeFileSync(invalid, "{not json");
  assert.throws(
    () => loadLock({ lockPath: invalid }),
    (error) =>
      error instanceof TemplateLockError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );
});
