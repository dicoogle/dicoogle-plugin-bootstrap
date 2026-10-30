import assert from "node:assert/strict";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import {
  DEFAULT_API_VERSION,
  DEFAULT_AUTHOR,
  DEFAULT_PLUGIN_VERSION,
  JAVA_FAMILIES,
  WEB_HOOKS,
  validateApiVersion,
  validateAuthor,
  validateDescription,
  validateDisplayName,
  validateFamily,
  validateGenerationOptions,
  validateHooks,
  validateLicense,
  validatePackageName,
  validatePluginId,
  validatePluginVersion,
  validateScheme,
  validateTypeToken,
} from "../src/validate.mjs";

function expectUsageError(fn, pattern, suggestion) {
  assert.throws(fn, (error) => {
    assert.equal(error.exitCode, EXIT_CODES.USAGE);
    if (pattern) {
      assert.match(error.message, pattern);
    }
    if (suggestion !== undefined) {
      assert.ok(
        error.message.includes(`Suggested: ${JSON.stringify(suggestion)}`),
        error.message,
      );
    }
    return true;
  });
}

test("valid plugin ids are accepted unchanged", () => {
  const cases = [
    "a",
    "a1",
    "my-dicom-store",
    "a-b-c",
    "plugin-123",
    "a".repeat(64),
  ];

  for (const id of cases) {
    assert.equal(validatePluginId(id), id);
  }
});

test("invalid plugin ids are rejected with suggestions", () => {
  const cases = [
    ["", /must not be empty/, "my-plugin"],
    ["../x", /lowercase kebab-case/, "x"],
    ["a/b", /lowercase kebab-case/, "a-b"],
    ["My-Plugin", /lowercase kebab-case/, "my-plugin"],
    ["-foo", /lowercase kebab-case/, "foo"],
    ["foo-", /lowercase kebab-case/, "foo"],
    ["foo--bar", /lowercase kebab-case/, "foo-bar"],
    ["foo_bar", /lowercase kebab-case/, "foo-bar"],
    ["foo.bar", /lowercase kebab-case/, "foo-bar"],
    ["1foo", /lowercase kebab-case/, "plugin-1foo"],
    ["foo bar", /lowercase kebab-case/, "foo-bar"],
    ["class", /reserved word/, "class-plugin"],
    ["record", /reserved word/, "record-plugin"],
    ["var", /reserved word/, "var-plugin"],
    ["yield", /reserved word/, "yield-plugin"],
    ["sealed", /reserved word/, "sealed-plugin"],
    ["permits", /reserved word/, "permits-plugin"],
    ["a".repeat(65), /at most 64/, "a".repeat(64)],
  ];

  for (const [id, pattern, suggestion] of cases) {
    expectUsageError(() => validatePluginId(id), pattern, suggestion);
  }
});

test("plugin id missing value is a required-flag error", () => {
  expectUsageError(
    () => validatePluginId(undefined),
    /missing required flag "--id"/,
  );
});

test("name, description, and author limits are enforced", () => {
  assert.equal(validateDisplayName("My Plugin"), "My Plugin");
  assert.equal(validateDisplayName("  My Plugin  "), "My Plugin");
  assert.equal(validateDisplayName("Café"), "Café");
  assert.equal(validateDisplayName(undefined, { fallback: "Fallback" }), "Fallback");
  expectUsageError(() => validateDisplayName(""), /must not be empty/);
  expectUsageError(
    () => validateDisplayName("bad\nname"),
    /control characters/,
  );
  expectUsageError(
    () => validateDisplayName("a".repeat(81)),
    /at most 80 characters/,
  );

  assert.equal(validateDescription("x".repeat(200)).length, 200);
  expectUsageError(
    () => validateDescription("x".repeat(201)),
    /at most 200 characters/,
  );

  assert.equal(validateAuthor(undefined), DEFAULT_AUTHOR);
  expectUsageError(
    () => validateAuthor("a".repeat(81)),
    /at most 80 characters/,
  );
});

test("plugin versions are validated and defaulted", () => {
  const valid = [
    "0.1.0",
    "1.2.3-SNAPSHOT",
    "1.0.0+build.5",
    "10.20.30-rc.1",
  ];

  for (const version of valid) {
    assert.equal(validatePluginVersion(version), version);
  }

  assert.equal(validatePluginVersion(undefined), DEFAULT_PLUGIN_VERSION);

  const invalid = [
    ["v1.0.0", "1.0.0"],
    ["1.0", "1.0.0"],
    ["1", "1.0.0"],
    ["1.0.0.0", "1.0.0"],
    ["foo", "0.1.0"],
    ["", "0.1.0"],
  ];

  for (const [version, suggestion] of invalid) {
    expectUsageError(
      () => validatePluginVersion(version),
      /expected semver-like/,
      suggestion,
    );
  }
});

test("package names are validated with suggestions", () => {
  const valid = [
    "org.dicoogle.storage.mydicomstore",
    "com.example.foo_bar",
  ];

  for (const packageName of valid) {
    assert.equal(validatePackageName(packageName), packageName);
  }

  assert.equal(validatePackageName(undefined), undefined);

  const invalid = [
    ["foo", "org.example.foo"],
    ["org..foo", "org.example.foo"],
    ["org.class.foo", "org.class_pkg.foo"],
    ["org.dicoogle.my-store", "org.dicoogle.my_store"],
    ["Org.Dicoogle.Storage", "org.dicoogle.storage"],
  ];

  for (const [packageName, suggestion] of invalid) {
    expectUsageError(
      () => validatePackageName(packageName),
      /invalid --package/,
      suggestion,
    );
  }
});

test("scheme values are validated with suggestions", () => {
  const valid = ["file", "my-dicom-store", "s3+https", "a.b"];

  for (const scheme of valid) {
    assert.equal(validateScheme(scheme), scheme);
  }

  assert.equal(validateScheme(undefined, { fallback: "fallback" }), "fallback");

  const invalid = [
    ["1file", "scheme-1file"],
    ["my scheme", "my-scheme"],
    ["bad!", "bad"],
    ["", "scheme"],
  ];

  for (const [scheme, suggestion] of invalid) {
    expectUsageError(
      () => validateScheme(scheme),
      /expected a URI scheme/,
      suggestion,
    );
  }
});

test("api-version accepts only 1 or 1.0 and normalizes to 1.0", () => {
  assert.equal(validateApiVersion("1"), DEFAULT_API_VERSION);
  assert.equal(validateApiVersion("1.0"), DEFAULT_API_VERSION);
  assert.equal(validateApiVersion(undefined), DEFAULT_API_VERSION);

  for (const version of ["2.0", "1.0.0", "", " 1.0 "]) {
    expectUsageError(
      () => validateApiVersion(version),
      /only "1" or "1.0"/,
    );
  }
});

test("web hooks are validated, deduplicated, and required", () => {
  assert.deepEqual(validateHooks("route"), ["route"]);
  assert.deepEqual(validateHooks("route, sidebar-menu"), [
    "route",
    "sidebar-menu",
  ]);
  assert.deepEqual(validateHooks("query-filter,route,settings"), [
    "query-filter",
    "route",
    "settings",
  ]);

  for (const hooks of ["bogus", "", ","]) {
    expectUsageError(
      () => validateHooks(hooks),
      new RegExp(`Valid hooks: ${WEB_HOOKS.join(", ")}`),
    );
  }

  expectUsageError(
    () => validateHooks("route,route"),
    /duplicate hook/,
  );
  expectUsageError(
    () => validateHooks(undefined),
    /missing required flag "--hooks"/,
  );
});

test("java families are validated", () => {
  for (const family of JAVA_FAMILIES) {
    assert.equal(validateFamily(family), family);
  }

  for (const family of [undefined, "", "query", "service"]) {
    expectUsageError(
      () => validateFamily(family),
      new RegExp(`expected one of|missing required flag`),
    );
  }

  expectUsageError(
    () => validateFamily("dimse"),
    /family not supported: "dimse"/,
  );
});

test("license values are optional, SPDX-like, and one-line only", () => {
  assert.equal(validateLicense(undefined), null);
  assert.equal(validateLicense("none"), null);
  assert.equal(validateLicense("NONE"), null);
  assert.equal(validateLicense("MIT"), "MIT");
  assert.equal(validateLicense("GPL-3.0-only"), "GPL-3.0-only");
  assert.equal(validateLicense("  Apache-2.0  "), "Apache-2.0");

  for (const license of ["", "MIT License", "-MIT", "a".repeat(65)]) {
    expectUsageError(() => validateLicense(license), /invalid --license/);
  }
});

test("type tokens must be single non-empty tokens", () => {
  assert.equal(validateTypeToken(undefined), undefined);
  assert.equal(validateTypeToken("storage"), "storage");
  assert.equal(validateTypeToken("  custom-token  "), "custom-token");

  for (const type of ["", "two words", "a".repeat(65)]) {
    expectUsageError(() => validateTypeToken(type), /invalid --type/);
  }
});


test("query-index requires at least one capability", () => {
  expectUsageError(
    () =>
      validateGenerationOptions({
        command: "java",
        flags: { id: "my-index", family: "query-index" },
      }),
    /requires at least one of --ingest/,
  );
});

test("query-index validation rejects --locator", () => {
  expectUsageError(
    () =>
      validateGenerationOptions({
        command: "java",
        flags: {
          id: "my-index",
          family: "query-index",
          query: true,
          locator: true,
        },
      }),
    /--locator is not supported/,
  );
});

test("validateGenerationOptions fills documented defaults for java", () => {
  const result = validateGenerationOptions({
    command: "java",
    flags: { id: "my-dicom-store", family: "storage" },
  });

  assert.equal(result.values.id, "my-dicom-store");
  assert.equal(result.values.family, "storage");
  assert.equal(result.values.name, "My Dicom Store");
  assert.equal(
    result.values.description,
    "TODO: describe My Dicom Store",
  );
  assert.equal(result.values.author, DEFAULT_AUTHOR);
  assert.equal(result.values.pluginVersion, DEFAULT_PLUGIN_VERSION);
  assert.equal(result.values.license, null);
  assert.equal(result.values.scheme, "my-dicom-store");
  assert.deepEqual(result.warnings, []);
});

test("validateGenerationOptions validates explicit java values", () => {
  const result = validateGenerationOptions({
    command: "java",
    flags: {
      id: "my-dicom-store",
      family: "storage",
      name: "My Store",
      description: "Stores things",
      author: "Team",
      pluginVersion: "1.2.3",
      license: "MIT",
      package: "com.example.mystore",
      scheme: "mystore",
      type: "custom",
    },
  });

  assert.equal(result.values.name, "My Store");
  assert.equal(result.values.description, "Stores things");
  assert.equal(result.values.author, "Team");
  assert.equal(result.values.pluginVersion, "1.2.3");
  assert.equal(result.values.license, "MIT");
  assert.equal(result.values.package, "com.example.mystore");
  assert.equal(result.values.scheme, "mystore");
  assert.equal(result.values.type, "custom");
});

test("validateGenerationOptions requires exactly one listener kind", () => {
  for (const flags of [
    { id: "my-audit", family: "listener" },
    {
      id: "my-audit",
      family: "listener",
      ingest: true,
      retrieve: true,
    },
  ]) {
    expectUsageError(
      () => validateGenerationOptions({ command: "java", flags }),
      /exactly one of --ingest or --retrieve/,
    );
  }

  const ingest = validateGenerationOptions({
    command: "java",
    flags: { id: "my-audit", family: "listener", ingest: true },
  });
  assert.equal(ingest.values.listenerKind, "ingest");

  const retrieve = validateGenerationOptions({
    command: "java",
    flags: { id: "my-audit", family: "listener", retrieve: true },
  });
  assert.equal(retrieve.values.listenerKind, "retrieve");
});

test("validateGenerationOptions derives web plugin metadata", () => {
  const single = validateGenerationOptions({
    command: "web",
    flags: { id: "date-range", hooks: "query-filter" },
  });

  assert.deepEqual(single.values.hooks, ["query-filter"]);
  assert.equal(single.values.apiVersion, DEFAULT_API_VERSION);
  assert.equal(single.values.pluginType, "query-filter");
  assert.equal(single.values.entry, "index.ts");

  const multi = validateGenerationOptions({
    command: "web",
    flags: {
      id: "study-tools",
      hooks: "route,sidebar-menu,settings",
    },
  });

  assert.deepEqual(multi.values.hooks, [
    "route",
    "sidebar-menu",
    "settings",
  ]);
  assert.equal(multi.values.pluginType, "multi");

  const override = validateGenerationOptions({
    command: "web",
    flags: {
      id: "study-tools",
      hooks: "route,settings",
      type: "custom",
    },
  });

  assert.equal(override.values.pluginType, "custom");
});

test("validateGenerationOptions requires id, family, and hooks", () => {
  expectUsageError(
    () =>
      validateGenerationOptions({
        command: "java",
        flags: { family: "storage" },
      }),
    /missing required flag "--id"/,
  );

  expectUsageError(
    () =>
      validateGenerationOptions({
        command: "java",
        flags: { id: "my-plugin" },
      }),
    /missing required flag "--family"/,
  );

  expectUsageError(
    () =>
      validateGenerationOptions({
        command: "web",
        flags: { id: "my-plugin" },
      }),
    /missing required flag "--hooks"/,
  );
});

test("validateGenerationOptions reports package-collision warnings", () => {
  const result = validateGenerationOptions(
    {
      command: "java",
      flags: { id: "foo-bar", family: "storage" },
    },
    { knownIds: ["foobar"] },
  );

  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /package segment "foobar"/);
  assert.match(result.warnings[0], /collides with "foobar"/);
});

test("validateGenerationOptions is a no-op for non-generation commands", () => {
  const result = validateGenerationOptions({
    command: "list",
    flags: {},
  });

  assert.equal(result.values, null);
  assert.deepEqual(result.warnings, []);
});
