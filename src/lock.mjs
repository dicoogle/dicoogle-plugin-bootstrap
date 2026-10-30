import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CliError, EXIT_CODES } from "./errors.mjs";
import { LISTENER_IDENTITIES } from "./naming.mjs";

export const LOCK_SCHEMA_VERSION = 1;
export const LOCK_GENERATOR = "dicoogle-plugin-bootstrap";
export const DEFAULT_LOCK_PATH = fileURLToPath(
  new URL("../templates/lock.json", import.meta.url),
);
export const DEFAULT_TEMPLATES_DIR = fileURLToPath(
  new URL("../templates", import.meta.url),
);

export const PLACEHOLDER_NAME_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const TEMPLATE_PATH_PATTERN = /^[A-Za-z0-9._/-]+$/;

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

function validateTemplatePath(templatePath) {
  if (typeof templatePath !== "string" || templatePath.length === 0) {
    fail("template paths must be non-empty strings.");
  }

  if (
    !TEMPLATE_PATH_PATTERN.test(templatePath) ||
    templatePath.startsWith("/") ||
    templatePath.endsWith("/") ||
    templatePath.split("/").includes("..") ||
    templatePath.split("/").includes(".")
  ) {
    fail(
      `invalid template path "${templatePath}": use a relative POSIX path ` +
        "without '.' or '..' segments.",
    );
  }
}

function validateListenerIdentities(identities) {
  assertObject(identities, "listenerIdentities");

  const expected = {
    ingest: {
      domain: LISTENER_IDENTITIES.ingest.domain,
      package: `org.dicoogle.${LISTENER_IDENTITIES.ingest.domain}.<id-without-hyphens>`,
      artifactId: `dicoogle-next-${LISTENER_IDENTITIES.ingest.domain}-<id>`,
      configPrefix: `app.${LISTENER_IDENTITIES.ingest.domain}.<id>`,
      pluginType: LISTENER_IDENTITIES.ingest.pluginType,
      classSuffix: LISTENER_IDENTITIES.ingest.classSuffix,
    },
    retrieve: {
      domain: LISTENER_IDENTITIES.retrieve.domain,
      package: `org.dicoogle.${LISTENER_IDENTITIES.retrieve.domain}.<id-without-hyphens>`,
      artifactId: `dicoogle-next-${LISTENER_IDENTITIES.retrieve.domain}-<id>`,
      configPrefix: `app.${LISTENER_IDENTITIES.retrieve.domain}.<id>`,
      pluginType: LISTENER_IDENTITIES.retrieve.pluginType,
      classSuffix: LISTENER_IDENTITIES.retrieve.classSuffix,
    },
  };

  for (const kind of ["ingest", "retrieve"]) {
    const entry = identities[kind];
    assertObject(entry, `listenerIdentities.${kind}`);

    for (const field of [
      "domain",
      "package",
      "artifactId",
      "configPrefix",
      "pluginType",
      "classSuffix",
    ]) {
      assertNonEmptyString(
        entry[field],
        `listenerIdentities.${kind}.${field}`,
      );

      if (entry[field] !== expected[kind][field]) {
        fail(
          `listenerIdentities.${kind}.${field} must be ` +
            `"${expected[kind][field]}" to match naming.mjs (found ` +
            `"${entry[field]}").`,
        );
      }
    }
  }

  for (const key of Object.keys(identities)) {
    if (key !== "ingest" && key !== "retrieve") {
      fail(`listenerIdentities has unknown kind "${key}".`);
    }
  }
}

function validateTemplateEntries(templates) {
  assertObject(templates, "templates");

  const entries = Object.entries(templates);

  if (entries.length === 0) {
    fail("templates must declare at least one template.");
  }

  for (const [templatePath, entry] of entries) {
    validateTemplatePath(templatePath);
    assertObject(entry, `templates["${templatePath}"]`);
    assertNonEmptyString(
      entry.source,
      `templates["${templatePath}"].source`,
    );

    if (
      typeof entry.sha256 !== "string" ||
      !SHA256_PATTERN.test(entry.sha256)
    ) {
      fail(
        `templates["${templatePath}"].sha256 must be a 64-character ` +
          "lowercase hex SHA-256.",
      );
    }

    if (!Array.isArray(entry.placeholders)) {
      fail(
        `templates["${templatePath}"].placeholders must be an array.`,
      );
    }

    const seen = new Set();

    for (const placeholder of entry.placeholders) {
      if (
        typeof placeholder !== "string" ||
        !PLACEHOLDER_NAME_PATTERN.test(placeholder)
      ) {
        fail(
          `templates["${templatePath}"].placeholders contains an ` +
            "invalid placeholder name.",
        );
      }

      if (seen.has(placeholder)) {
        fail(
          `templates["${templatePath}"].placeholders contains ` +
            `duplicate placeholder "${placeholder}".`,
        );
      }

      seen.add(placeholder);
    }
  }
}

export function validateLockSchema(lock) {
  assertObject(lock, "template lock");

  if (lock.schemaVersion !== LOCK_SCHEMA_VERSION) {
    fail(
      `template lock schemaVersion must be ${LOCK_SCHEMA_VERSION}.`,
    );
  }

  if (lock.generatedBy !== LOCK_GENERATOR) {
    fail(
      `template lock generatedBy must be "${LOCK_GENERATOR}".`,
    );
  }

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

  validateListenerIdentities(lock.listenerIdentities);
  validateTemplateEntries(lock.templates);

  return lock;
}

export function extractPlaceholders(content) {
  const used = new Set();
  const tokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let match;

  while ((match = tokenPattern.exec(String(content))) !== null) {
    const token = match[1].trim();

    if (
      token.length === 0 ||
      token.startsWith("/") ||
      token.startsWith("!")
    ) {
      continue;
    }

    if (token.startsWith("#")) {
      const [helper, ...rest] = token.slice(1).trim().split(/\s+/);

      if (
        ["if", "unless", "each"].includes(helper) &&
        rest.length > 0 &&
        PLACEHOLDER_NAME_PATTERN.test(rest[0])
      ) {
        used.add(rest[0]);
      }

      continue;
    }

    if (token === "else") {
      continue;
    }

    const name = token.split(/\s+/)[0];

    if (PLACEHOLDER_NAME_PATTERN.test(name)) {
      used.add(name);
    }
  }

  return [...used].sort();
}

export function verifyTemplates(
  lock,
  { templatesDir = DEFAULT_TEMPLATES_DIR } = {},
) {
  const baseDir = path.resolve(templatesDir);
  const issues = [];
  const results = [];

  for (const [templatePath, entry] of Object.entries(lock.templates)) {
    const resolvedPath = path.resolve(baseDir, templatePath);

    if (
      resolvedPath !== baseDir &&
      !resolvedPath.startsWith(`${baseDir}${path.sep}`)
    ) {
      issues.push(
        `template path escapes templates directory: ${templatePath}`,
      );
      continue;
    }

    let stats;

    try {
      stats = statSync(resolvedPath);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        issues.push(`template file missing: ${templatePath}`);
      } else {
        issues.push(
          `template file cannot be read: ${templatePath} ` +
            `(${error.message})`,
        );
      }
      continue;
    }

    if (!stats.isFile()) {
      issues.push(`template path is not a file: ${templatePath}`);
      continue;
    }

    let buffer;

    try {
      buffer = readFileSync(resolvedPath);
    } catch (error) {
      issues.push(
        `template file cannot be read: ${templatePath} ` +
          `(${error.message})`,
      );
      continue;
    }

    const actualHash = createHash("sha256")
      .update(buffer)
      .digest("hex");

    if (actualHash !== entry.sha256) {
      issues.push(
        `template hash mismatch: ${templatePath} ` +
          `(expected ${entry.sha256}, got ${actualHash})`,
      );
    }

    const usedPlaceholders = extractPlaceholders(
      buffer.toString("utf8"),
    );
    const declaredPlaceholders = [...entry.placeholders].sort();
    const missing = usedPlaceholders.filter(
      (placeholder) => !declaredPlaceholders.includes(placeholder),
    );
    const unused = declaredPlaceholders.filter(
      (placeholder) => !usedPlaceholders.includes(placeholder),
    );

    if (missing.length > 0) {
      issues.push(
        `template uses undeclared placeholder(s): ${templatePath}: ` +
          missing.join(", "),
      );
    }

    if (unused.length > 0) {
      issues.push(
        `template declares unused placeholder(s): ${templatePath}: ` +
          unused.join(", "),
      );
    }

    results.push({
      path: templatePath,
      sha256: actualHash,
      placeholders: usedPlaceholders,
    });
  }

  if (issues.length > 0) {
    throw new TemplateLockError(issues.join("\n"));
  }

  return results;
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

  return validateLockSchema(lock);
}

export function verifyLock({
  lockPath = DEFAULT_LOCK_PATH,
  templatesDir = DEFAULT_TEMPLATES_DIR,
} = {}) {
  const lock = readLock(lockPath);
  const templates = verifyTemplates(lock, { templatesDir });
  return { lock, templates };
}

export function loadLock({
  lockPath = DEFAULT_LOCK_PATH,
  templatesDir = DEFAULT_TEMPLATES_DIR,
  verify = true,
} = {}) {
  if (!verify) {
    return readLock(lockPath);
  }

  return verifyLock({ lockPath, templatesDir }).lock;
}
