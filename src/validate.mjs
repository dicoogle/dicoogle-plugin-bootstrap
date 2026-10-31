import { UsageError } from "./errors.mjs";
import {
  packageCollisionWarnings,
  titleCase,
} from "./naming.mjs";

export const JAVA_FAMILIES = Object.freeze([
  "storage",
  "query-index",
  "listener",
]);

export const WEB_HOOKS = Object.freeze([
  "query-filter",
  "result-options",
  "result-batch",
  "result-renderer",
  "sidebar-menu",
  "route",
  "settings",
]);

export const DEFAULT_PLUGIN_VERSION = "0.1.0";
export const DEFAULT_AUTHOR = "Unknown";
export const DEFAULT_API_VERSION = "1.0";
export const MAX_PLUGIN_ID_LENGTH = 64;

export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const PACKAGE_PATTERN =
  /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
export const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;
export const PLUGIN_VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:[-+].*)?$/;
export const SPDX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

export const RESERVED_JAVA_WORDS = new Set([
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "null",
  "package",
  "permits",
  "private",
  "protected",
  "public",
  "record",
  "return",
  "sealed",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "var",
  "void",
  "volatile",
  "when",
  "while",
  "yield",
  "_",
]);

function quote(value) {
  return JSON.stringify(String(value));
}

function fail(message) {
  throw new UsageError(message);
}

function requireFlag(flags, key, flag, hint) {
  if (flags[key] === undefined) {
    const suffix = hint ? ` (${hint})` : "";
    fail(`missing required flag "${flag}"${suffix}`);
  }

  return flags[key];
}

function validateText(value, { flag, maxLength, fallback }) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const trimmed = String(value).trim();

  if (trimmed.length === 0) {
    fail(`invalid ${flag}: must not be empty.`);
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    fail(`invalid ${flag}: must not contain control characters or newlines.`);
  }

  const length = [...trimmed].length;

  if (length > maxLength) {
    fail(
      `invalid ${flag}: must be at most ${maxLength} characters (got ${length}).`,
    );
  }

  return trimmed;
}

export function suggestPluginId(value) {
  let suggestion = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (suggestion.length === 0) {
    suggestion = "my-plugin";
  }

  if (!/^[a-z]/.test(suggestion)) {
    suggestion = `plugin-${suggestion}`;
  }

  if (suggestion.length > MAX_PLUGIN_ID_LENGTH) {
    suggestion = suggestion
      .slice(0, MAX_PLUGIN_ID_LENGTH)
      .replace(/-+$/g, "");
  }

  if (RESERVED_JAVA_WORDS.has(suggestion.replaceAll("-", ""))) {
    suggestion = `${suggestion}-plugin`;
  }

  return suggestion;
}

function invalidPluginId(raw, reason) {
  fail(
    `invalid plugin id ${quote(raw)}: ${reason}. ` +
      `Suggested: ${quote(suggestPluginId(raw))}.`,
  );
}

export function validatePluginId(value, { flag = "--id" } = {}) {
  if (value === undefined || value === null) {
    fail(`missing required flag "${flag}"`);
  }

  const raw = String(value);

  if (raw.length === 0) {
    invalidPluginId(raw, "must not be empty");
  }

  if (raw.length > MAX_PLUGIN_ID_LENGTH) {
    invalidPluginId(
      raw,
      `must be at most ${MAX_PLUGIN_ID_LENGTH} characters`,
    );
  }

  if (!PLUGIN_ID_PATTERN.test(raw)) {
    invalidPluginId(
      raw,
      "must be lowercase kebab-case matching " + PLUGIN_ID_PATTERN,
    );
  }

  const normalized = raw.replaceAll("-", "");

  if (RESERVED_JAVA_WORDS.has(normalized)) {
    invalidPluginId(
      raw,
      `normalizes to the Java reserved word ${quote(normalized)}`,
    );
  }

  return raw;
}

export function validateReservedPluginId(id, reservedIds = []) {
  const reserved = new Set(reservedIds);

  if (reserved.has(id)) {
    fail(
      `invalid plugin id ${quote(id)}: it is a reserved bundled plugin id. ` +
        "QueryRouter keys providers by metadata().id(), so a duplicate would " +
        "silently overwrite the bundled plugin. Choose another --id.",
    );
  }

  return id;
}

export function validateDisplayName(value, options = {}) {
  return validateText(value, {
    flag: "--name",
    maxLength: 80,
    fallback: options.fallback,
  });
}

export function validateDescription(value, options = {}) {
  return validateText(value, {
    flag: "--description",
    maxLength: 200,
    fallback: options.fallback,
  });
}

export function validateAuthor(value, options = {}) {
  return validateText(value, {
    flag: "--author",
    maxLength: 80,
    fallback: options.fallback ?? DEFAULT_AUTHOR,
  });
}

export function suggestPluginVersion(value) {
  let suggestion = String(value ?? "")
    .trim()
    .replace(/^v/i, "");

  if (/^\d+$/.test(suggestion)) {
    suggestion = `${suggestion}.0.0`;
  } else if (/^\d+\.\d+$/.test(suggestion)) {
    suggestion = `${suggestion}.0`;
  }

  if (!PLUGIN_VERSION_PATTERN.test(suggestion)) {
    const match = suggestion.match(/^(\d+)\.(\d+)\.(\d+)/);
    suggestion = match
      ? `${match[1]}.${match[2]}.${match[3]}`
      : DEFAULT_PLUGIN_VERSION;
  }

  return suggestion;
}

export function validatePluginVersion(
  value,
  { flag = "--plugin-version", fallback = DEFAULT_PLUGIN_VERSION } = {},
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const raw = String(value);

  if (!PLUGIN_VERSION_PATTERN.test(raw)) {
    fail(
      `invalid ${flag} ${quote(raw)}: expected semver-like ` +
        `MAJOR.MINOR.PATCH with an optional suffix. ` +
        `Suggested: ${quote(suggestPluginVersion(raw))}.`,
    );
  }

  return raw;
}

export function suggestPackageName(value) {
  const segments = String(value ?? "")
    .trim()
    .toLowerCase()
    .split(".")
    .map((segment) => {
      let cleaned = segment.replace(/[^a-z0-9_]/g, "_");
      cleaned = cleaned.replace(/^_+|_+$/g, "");

      if (cleaned.length === 0) {
        cleaned = "example";
      }

      if (!/^[a-z_]/.test(cleaned)) {
        cleaned = `p_${cleaned}`;
      }

      if (RESERVED_JAVA_WORDS.has(cleaned)) {
        cleaned = `${cleaned}_pkg`;
      }

      return cleaned;
    });

  if (segments.length < 2) {
    return ["org", "example", ...segments].join(".");
  }

  return segments.join(".");
}

export function validatePackageName(
  value,
  { flag = "--package" } = {},
) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const raw = String(value);

  if (!PACKAGE_PATTERN.test(raw)) {
    fail(
      `invalid ${flag} ${quote(raw)}: expected lowercase dot-separated ` +
        `Java package names matching ${PACKAGE_PATTERN}. ` +
        `Suggested: ${quote(suggestPackageName(raw))}.`,
    );
  }

  const reserved = raw
    .split(".")
    .find((segment) => RESERVED_JAVA_WORDS.has(segment));

  if (reserved) {
    fail(
      `invalid ${flag} ${quote(raw)}: segment ${quote(reserved)} is a ` +
        `Java reserved word. Suggested: ${quote(suggestPackageName(raw))}.`,
    );
  }

  return raw;
}

export function suggestScheme(value) {
  let suggestion = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (suggestion.length === 0) {
    suggestion = "scheme";
  }

  if (!/^[a-z]/.test(suggestion)) {
    suggestion = `scheme-${suggestion}`;
  }

  return suggestion;
}

export function validateScheme(
  value,
  { flag = "--scheme", fallback } = {},
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const raw = String(value);

  if (!SCHEME_PATTERN.test(raw)) {
    fail(
      `invalid ${flag} ${quote(raw)}: expected a URI scheme matching ` +
        `${SCHEME_PATTERN}. Suggested: ${quote(suggestScheme(raw))}.`,
    );
  }

  return raw;
}

export function validateApiVersion(
  value,
  { flag = "--api-version", fallback = DEFAULT_API_VERSION } = {},
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const raw = String(value);

  if (raw !== "1" && raw !== "1.0") {
    fail(
      `invalid ${flag} ${quote(raw)}: only "1" or "1.0" are supported. ` +
        'Suggested: "1.0".',
    );
  }

  return DEFAULT_API_VERSION;
}

export function validateHooks(value, { flag = "--hooks" } = {}) {
  if (value === undefined || value === null) {
    fail(`missing required flag "${flag}"`);
  }

  const raw = String(value);
  const hooks = raw
    .split(",")
    .map((hook) => hook.trim())
    .filter((hook) => hook.length > 0);

  if (hooks.length === 0) {
    fail(
      `invalid ${flag} ${quote(raw)}: at least one hook is required. ` +
        `Valid hooks: ${WEB_HOOKS.join(", ")}.`,
    );
  }

  const unknown = hooks.find((hook) => !WEB_HOOKS.includes(hook));

  if (unknown) {
    fail(
      `invalid ${flag}: unknown hook ${quote(unknown)}. ` +
        `Valid hooks: ${WEB_HOOKS.join(", ")}.`,
    );
  }

  const seen = new Set();
  const duplicates = [];

  for (const hook of hooks) {
    if (seen.has(hook)) {
      duplicates.push(hook);
    } else {
      seen.add(hook);
    }
  }

  if (duplicates.length > 0) {
    fail(
      `invalid ${flag}: duplicate hook(s) ` +
        `${[...new Set(duplicates)].map(quote).join(", ")}.`,
    );
  }

  return hooks;
}

export function validateFamily(value, { flag = "--family" } = {}) {
  if (value === undefined || value === null) {
    fail(
      `missing required flag "${flag}" ` +
        `(one of: ${JAVA_FAMILIES.join(", ")})`,
    );
  }

  const raw = String(value);

  if (raw === "dimse") {
    fail(
      `family not supported: "dimse" (DIMSE generation is descoped).`,
    );
  }

  if (!JAVA_FAMILIES.includes(raw)) {
    fail(
      `invalid ${flag} ${quote(raw)}: expected one of ` +
        `${JAVA_FAMILIES.join(", ")}.`,
    );
  }

  return raw;
}

export function validateLicense(
  value,
  { flag = "--license", fallback = null } = {},
) {
  if (value === undefined || value === null) {
    return fallback;
  }

  const raw = String(value);
  const trimmed = raw.trim();

  if (trimmed.toLowerCase() === "none") {
    return null;
  }

  if (trimmed.length === 0) {
    fail(`invalid ${flag}: must be "none" or an SPDX identifier.`);
  }

  if (trimmed.length > 64) {
    fail(`invalid ${flag}: SPDX identifier must be at most 64 characters.`);
  }

  if (!SPDX_PATTERN.test(trimmed)) {
    fail(
      `invalid ${flag} ${quote(raw)}: expected "none" or an SPDX ` +
        'identifier such as "MIT" or "GPL-3.0-only".',
    );
  }

  return trimmed;
}

export function validateTypeToken(value, { flag = "--type" } = {}) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();

  if (trimmed.length === 0) {
    fail(`invalid ${flag}: must not be empty.`);
  }

  if ([...trimmed].length > 64) {
    fail(`invalid ${flag}: must be at most 64 characters.`);
  }

  if (/\s/.test(trimmed) || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    fail(`invalid ${flag}: must be a single token without whitespace.`);
  }

  return trimmed;
}

export function validateGenerationOptions(
  parsed,
  { knownIds = [] } = {},
) {
  if (!parsed || !["java", "web"].includes(parsed.command)) {
    return {
      command: parsed?.command ?? null,
      flags: parsed?.flags ?? {},
      values: null,
      warnings: [],
    };
  }

  const { command, flags } = parsed;
  const id = validatePluginId(requireFlag(flags, "id", "--id"));
  const displayName = titleCase(id);

  const values = {
    id,
    name: validateDisplayName(flags.name, {
      fallback: displayName,
    }),
    description: validateDescription(flags.description, {
      fallback: `TODO: describe ${displayName}`,
    }),
    author: validateAuthor(flags.author, {
      fallback: DEFAULT_AUTHOR,
    }),
    pluginVersion: validatePluginVersion(flags.pluginVersion),
    license: validateLicense(flags.license),
    type: validateTypeToken(flags.type),
  };

  if (command === "java") {
    values.family = validateFamily(
      requireFlag(
        flags,
        "family",
        "--family",
        `one of: ${JAVA_FAMILIES.join(", ")}`,
      ),
    );

    if (flags.package !== undefined) {
      values.package = validatePackageName(flags.package);
    }

    if (flags.scheme !== undefined) {
      values.scheme = validateScheme(flags.scheme);
    } else if (values.family === "storage") {
      values.scheme = id;
    }

    if (values.family === "listener") {
      const ingest = flags.ingest === true;
      const retrieve = flags.retrieve === true;

      if (ingest === retrieve) {
        throw new UsageError(
          "listener requires exactly one of --ingest or --retrieve.",
        );
      }

      values.listenerKind = ingest ? "ingest" : "retrieve";
    }

    if (values.family === "query-index") {
      if (flags.locator === true) {
        throw new UsageError(
          "--locator is not supported for the query-index family: only " +
            "storage plugins feed List<DicomInstanceLocator> on " +
            "dicoogle-next HEAD.",
        );
      }

      const capabilities = [
        "ingest",
        "query",
        "move",
        "maintenance",
        "settings",
      ];

      if (!capabilities.some((capability) => flags[capability] === true)) {
        throw new UsageError(
          "query-index requires at least one of --ingest, --query, " +
            "--move, --maintenance, or --settings.",
        );
      }
    }
  } else {
    values.hooks = validateHooks(
      requireFlag(
        flags,
        "hooks",
        "--hooks",
        `one of: ${WEB_HOOKS.join(", ")}`,
      ),
    );
    values.apiVersion = validateApiVersion(flags.apiVersion);
    values.pluginType =
      values.type ??
      (values.hooks.length === 1 ? values.hooks[0] : "multi");
    values.entry = "index.ts";
  }

  const warnings = packageCollisionWarnings(id, knownIds);

  if (
    command === "web" &&
    values.hooks.includes("sidebar-menu") &&
    !values.hooks.includes("route")
  ) {
    warnings.push(
      `web plugin id "${id}" includes sidebar-menu without route: ` +
        `the menu points to /plugins/${id} and needs a matching route ` +
        "extension. Add --hooks ...route or provide a route yourself.",
    );
  }

  return {
    command,
    flags,
    values,
    warnings,
  };
}
