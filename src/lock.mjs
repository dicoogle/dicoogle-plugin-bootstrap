import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CliError, EXIT_CODES } from "./errors.mjs";

export const DEFAULT_LOCK_PATH = fileURLToPath(
  new URL("../templates/lock.json", import.meta.url),
);
export const DEFAULT_TEMPLATES_DIR = fileURLToPath(
  new URL("../templates", import.meta.url),
);

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const RESERVED_PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export class TemplateLockError extends CliError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      exitCode: EXIT_CODES.TEMPLATE,
    });
    this.name = "TemplateLockError";
  }
}

function fail(message) {
  throw new TemplateLockError(message);
}

function assertObject(value, label) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    fail(`${label} must be an object.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function validateReservedPluginIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    fail("reservedPluginIds must be a non-empty array.");
  }

  const seen = new Set();

  for (const id of ids) {
    assertNonEmptyString(id, "reservedPluginIds entry");

    if (!RESERVED_PLUGIN_ID_PATTERN.test(id)) {
      fail(
        `reservedPluginIds entry "${id}" must be lowercase kebab-case.`,
      );
    }

    if (seen.has(id)) {
      fail(`reservedPluginIds contains duplicate "${id}".`);
    }

    seen.add(id);
  }
}

export function validateLock(lock) {
  assertObject(lock, "lock");
  assertObject(lock.dicoogleNext, "dicoogleNext");

  const pin = lock.dicoogleNext;

  for (const key of [
    "repository",
    "commit",
    "branchAtPin",
    "javaVersion",
    "mavenMinimum",
    "springBootVersion",
    "parentGroupId",
    "parentArtifactId",
    "parentVersion",
    "sdkArtifactId",
    "sdkVersion",
    "dcm4cheVersion",
    "webApiVersion",
  ]) {
    assertNonEmptyString(pin[key], `dicoogleNext.${key}`);
  }

  if (!COMMIT_PATTERN.test(pin.commit)) {
    fail(
      "dicoogleNext.commit must be a 40-character lowercase hex SHA.",
    );
  }

  validateReservedPluginIds(lock.reservedPluginIds);

  return lock;
}

export function readLock(lockPath = DEFAULT_LOCK_PATH) {
  let raw;

  try {
    raw = readFileSync(lockPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      fail(`template lock not found: ${lockPath}`);
    }

    fail(
      `template lock cannot be read: ${lockPath} (${error.message})`,
    );
  }

  let lock;

  try {
    lock = JSON.parse(raw);
  } catch (error) {
    fail(
      `template lock is not valid JSON: ${lockPath} ` +
        `(${error.message})`,
    );
  }

  return validateLock(lock);
}

export function loadLock({ lockPath = DEFAULT_LOCK_PATH } = {}) {
  return readLock(lockPath);
}
