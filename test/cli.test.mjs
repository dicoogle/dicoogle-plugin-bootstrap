import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  HELP_TEXT,
  TOOL_VERSION,
  assertSupportedNode,
  installSigintHandler,
  main,
} from "../src/cli.mjs";
import { EXIT_CODES } from "../src/errors.mjs";

const BIN = fileURLToPath(
  new URL("../bin/dicoogle-plugin-bootstrap.mjs", import.meta.url),
);

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

test("--help prints usage and exits 0", async () => {
  const result = await run(["--help"]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^Usage: dicoogle-plugin-bootstrap <command>/);
  assert.match(result.stdout, /Commands:/);
  assert.match(result.stdout, /IndexSettingsController/);
  assert.match(result.stdout, /Exit codes:/);
});

test("-h prints usage and exits 0", async () => {
  const result = await run(["-h"]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.equal(result.stdout, HELP_TEXT);
});

test("no arguments prints usage and exits 0", async () => {
  const result = await run([]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.equal(result.stdout, HELP_TEXT);
});

test("java --help prints usage instead of the milestone stub", async () => {
  const result = await run(["java", "--help"]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.equal(result.stdout, HELP_TEXT);
});

test("version prints tool, Node, and lock status", async () => {
  const result = await run(["version"]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(
    result.stdout,
    new RegExp(`dicoogle-plugin-bootstrap ${TOOL_VERSION.replaceAll(".", "\\.")}`),
  );
  assert.match(result.stdout, new RegExp(`node ${process.versions.node.replaceAll(".", "\\.")}`));
  assert.match(result.stdout, /template lock:/);
});

test("list prints families, hooks, and lock status", async () => {
  const result = await run(["list"]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /Java families:/);
  assert.match(result.stdout, /storage/);
  assert.match(result.stdout, /query-index/);
  assert.match(result.stdout, /result-renderer/);
  assert.match(result.stdout, /Template lock:/);
});

test("unknown command exits 2", async () => {
  const result = await run(["wat"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /unknown command "wat"/);
  assert.match(result.stderr, /--help/);
});

test("unknown flag on list exits 2", async () => {
  const result = await run(["list", "--bogus"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unknown flag "--bogus"/);
});

test("unknown flag on java exits 2", async () => {
  const result = await run(["java", "--bogus"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unknown flag "--bogus"/);
});

test("missing flag value exits 2", async () => {
  const result = await run(["java", "--family"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /flag "--family" requires a value/);
});

test("a flag value cannot be another flag", async () => {
  const result = await run(["java", "--family", "--locator"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /flag "--family" requires a value/);
});

test("a boolean flag cannot take an inline value", async () => {
  const result = await run(["list", "--help=1"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /flag "--help" does not take a value/);
});

test("unexpected positional argument exits 2", async () => {
  const result = await run(["list", "extra"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unexpected argument "extra"/);
});

test("query-index --locator is rejected with exit 2", async () => {
  const result = await run(["java", "--family", "query-index", "--locator"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /--locator is not supported/);
  assert.match(result.stderr, /only storage plugins/);
});

test("storage --locator dry-run remains valid", async () => {
  const result = await run([
    "java",
    "--id",
    "my-plugin",
    "--family",
    "storage",
    "--locator",
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /dicoogle-next-storage-my-plugin\//);
});


test("storage generation refuses a non-empty target with exit 3", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-cli-target-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, "existing.txt"), "keep\n");

  const result = await run([
    "java",
    "--id",
    "my-store",
    "--family",
    "storage",
    "--out",
    dir,
  ]);

  assert.equal(result.code, EXIT_CODES.TARGET_NOT_EMPTY);
  assert.match(result.stderr, /target directory is not empty/);
});


test("query-index dry-run generates the expected tree in memory", async () => {
  const result = await run([
    "java",
    "--id",
    "my-index",
    "--family",
    "query-index",
    "--ingest",
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /dicoogle-next-query-my-index\//);
  assert.match(result.stdout, /MyIndexQueryIndexPlugin\.java/);
});

test("query-index without capabilities exits 2", async () => {
  const result = await run([
    "java",
    "--id",
    "my-index",
    "--family",
    "query-index",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /requires at least one of --ingest/);
});


test("--settings prints the settings displacement warning", async () => {
  const result = await run([
    "java",
    "--id",
    "my-index",
    "--family",
    "query-index",
    "--settings",
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stderr, /IndexSettingsController selects the FIRST/);
  assert.match(result.stderr, /keep at most one enabled/);
  assert.match(result.stdout, /dicoogle-next-query-my-index\//);
});

test("query-index without --settings does not print the settings warning", async () => {
  const result = await run([
    "java",
    "--id",
    "my-index",
    "--family",
    "query-index",
    "--query",
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.doesNotMatch(result.stderr, /IndexSettingsController/);
});

test("init is no longer a command", async () => {
  const result = await run(["init"]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unknown command "init"/);
});

test("removed flags are rejected", async () => {
  for (const flag of ["--repo", "--verbose", "--no-color"]) {
    const result = await run(["list", flag]);
    assert.equal(result.code, EXIT_CODES.USAGE, flag);
    assert.match(result.stderr, /unknown flag/, flag);
  }
});

test("DIMSE family is descoped with exit 2", async () => {
  const result = await run([
    "java",
    "--id",
    "my-plugin",
    "--family",
    "dimse",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /family not supported: "dimse"/);
});

test("listener dry-run works for ingest and retrieve", async () => {
  for (const kind of ["ingest", "retrieve"]) {
    const result = await run([
      "java",
      "--id",
      "my-audit",
      "--family",
      "listener",
      `--${kind}`,
      "--dry-run",
    ]);

    assert.equal(result.code, EXIT_CODES.OK);
    assert.match(
      result.stdout,
      new RegExp(
        kind === "ingest"
          ? "dicoogle-next-query-my-audit/"
          : "dicoogle-next-service-my-audit/",
      ),
    );
    assert.match(
      result.stdout,
      new RegExp(
        kind === "ingest"
          ? "MyAuditIngestListener\\.java"
          : "MyAuditRetrieveListener\\.java",
      ),
    );
  }
});

test("listener requires exactly one kind", async () => {
  const result = await run([
    "java",
    "--id",
    "my-audit",
    "--family",
    "listener",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /exactly one of --ingest or --retrieve/);
});

test("java missing required flags exits 2 before generation", async () => {
  const missingId = await run(["java", "--family", "storage"]);
  assert.equal(missingId.code, EXIT_CODES.USAGE);
  assert.match(missingId.stderr, /missing required flag "--id"/);

  const missingFamily = await run(["java", "--id", "my-plugin"]);
  assert.equal(missingFamily.code, EXIT_CODES.USAGE);
  assert.match(missingFamily.stderr, /missing required flag "--family"/);

  const missingHooks = await run(["web", "--id", "my-plugin"]);
  assert.equal(missingHooks.code, EXIT_CODES.USAGE);
  assert.match(missingHooks.stderr, /missing required flag "--hooks"/);
});

test("invalid ids exit 2 with a suggested valid form", async () => {
  const result = await run([
    "java",
    "--id",
    "../My Plugin",
    "--family",
    "storage",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /invalid plugin id/);
  assert.match(result.stderr, /Suggested: "my-plugin"/);
  assert.doesNotMatch(result.stdout, /not implemented yet/);
});

test("invalid web hooks exit 2 before generation", async () => {
  const result = await run([
    "web",
    "--id",
    "my-plugin",
    "--hooks",
    "route,bogus",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unknown hook "bogus"/);
  assert.doesNotMatch(result.stdout, /not implemented yet/);
});

test("invalid api-version exits 2", async () => {
  const result = await run([
    "web",
    "--id",
    "my-plugin",
    "--hooks",
    "route",
    "--api-version",
    "2.0",
  ]);

  assert.equal(result.code, EXIT_CODES.USAGE);
  assert.match(result.stderr, /only "1" or "1.0"/);
});

test("Node < 20 throws exit code 7 and Node >= 20 passes", () => {
  assert.throws(
    () => assertSupportedNode("18.20.1"),
    (error) => error.exitCode === EXIT_CODES.UNSUPPORTED_RUNTIME,
  );
  assert.throws(
    () => assertSupportedNode("19.9.0"),
    (error) => error.exitCode === EXIT_CODES.UNSUPPORTED_RUNTIME,
  );

  assert.equal(assertSupportedNode("20.0.0"), 20);
  assert.equal(assertSupportedNode("v22.22.0"), 22);
});

test("SIGINT handler exits 130", () => {
  let registered;
  let exitCode;

  const target = {
    on(event, handler) {
      assert.equal(event, "SIGINT");
      registered = handler;
    },
    exit(code) {
      exitCode = code;
    },
  };

  installSigintHandler(target);

  assert.equal(typeof registered, "function");
  registered();
  assert.equal(exitCode, EXIT_CODES.SIGINT);
});

test("bin entrypoint runs version successfully", () => {
  const result = spawnSync(process.execPath, [BIN, "version"], {
    encoding: "utf8",
  });

  assert.equal(result.status, EXIT_CODES.OK);
  assert.match(result.stdout, /dicoogle-plugin-bootstrap \d+\.\d+\.\d+/);
  assert.equal(result.stderr, "");
});

test("bin entrypoint preserves usage exit code 2", () => {
  const result = spawnSync(process.execPath, [BIN, "wat"], {
    encoding: "utf8",
  });

  assert.equal(result.status, EXIT_CODES.USAGE);
  assert.match(result.stderr, /unknown command "wat"/);
});


test("reserved bundled plugin ids exit 2 without writing", async (t) => {
  const parent = mkdtempSync(path.join(tmpdir(), "dicoogle-reserved-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));

  for (const id of [
    "lucene",
    "query-file-rw",
    "storage-file-ro",
    "storage-file-rw",
  ]) {
    const out = path.join(parent, id);
    const result = await run([
      "java",
      "--id",
      id,
      "--family",
      "storage",
      "--out",
      out,
    ]);

    assert.equal(result.code, EXIT_CODES.USAGE, id);
    assert.equal(result.stdout, "", id);
    assert.match(result.stderr, /reserved bundled plugin id/, id);
    assert.equal(existsSync(out), false, id);
  }
});


test("web generation writes plugin files and no package.json", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "dicoogle-web-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const result = await run([
    "web",
    "--id",
    "my-plugin",
    "--hooks",
    "route,sidebar-menu,settings",
    "--out",
    dir,
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /created 5 file\(s\)/);
  assert.equal(existsSync(path.join(dir, "package.json")), false);

  const config = JSON.parse(
    readFileSync(path.join(dir, "plugin.config.json"), "utf8"),
  );
  assert.equal(config.id, "my-plugin");
  assert.equal(config.entry, "index.ts");
  assert.equal(config.apiVersion, "1.0");
  assert.equal(config.type, "multi");

  const index = readFileSync(path.join(dir, "index.ts"), "utf8");
  assert.match(index, /getRouteExtensions/);
  assert.match(index, /getSidebarMenuExtensions/);
  assert.match(index, /getSettingsExtensions/);
  assert.doesNotMatch(index, /metadata:/);
  assert.ok(existsSync(path.join(dir, "MyPluginPage.tsx")));
  assert.ok(existsSync(path.join(dir, "MyPluginSettings.tsx")));
});

test("web dry-run prints the tree and writes nothing", async (t) => {
  const parent = mkdtempSync(path.join(tmpdir(), "dicoogle-web-dry-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const out = path.join(parent, "my-web");

  const result = await run([
    "web",
    "--id",
    "my-web",
    "--hooks",
    "query-filter",
    "--out",
    out,
    "--dry-run",
  ]);

  assert.equal(result.code, EXIT_CODES.OK);
  assert.match(result.stdout, /plugin\.config\.json/);
  assert.match(result.stdout, /MyWebFilter\.tsx/);
  assert.equal(existsSync(out), false);
});
