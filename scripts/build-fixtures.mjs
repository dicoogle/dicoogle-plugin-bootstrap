#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXIT_CODES,
  UsageError,
  formatError,
  normalizeError,
} from "../src/errors.mjs";
import { loadLock } from "../src/lock.mjs";

const TOOL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const CLI = path.join(
  TOOL_ROOT,
  "bin",
  "dicoogle-plugin-bootstrap.mjs",
);

const STORAGE_CASES = [
  { name: "readable", id: "fixture-r", flags: ["--readable"] },
  { name: "writable", id: "fixture-w", flags: ["--writable"] },
  { name: "listable", id: "fixture-l", flags: ["--listable"] },
  { name: "locator", id: "fixture-loc", flags: ["--locator"] },
  {
    name: "readable-writable",
    id: "fixture-rw",
    flags: ["--readable", "--writable"],
  },
  {
    name: "writable-locator",
    id: "fixture-wl",
    flags: ["--writable", "--locator"],
  },
  {
    name: "all",
    id: "fixture-all",
    flags: [
      "--readable",
      "--writable",
      "--listable",
      "--locator",
    ],
  },
];

const LISTENER_CASES = [
  {
    name: "ingest",
    id: "fixture-lst-ing",
    flags: ["--ingest"],
    artifactId: "dicoogle-next-query-fixture-lst-ing",
  },
  {
    name: "retrieve",
    id: "fixture-lst-ret",
    flags: ["--retrieve"],
    artifactId: "dicoogle-next-service-fixture-lst-ret",
  },
  {
    name: "ingest-long",
    id: "fixture-listener-ingest-long-identifier",
    flags: ["--ingest"],
    artifactId:
      "dicoogle-next-query-fixture-listener-ingest-long-identifier",
  },
  {
    name: "retrieve-long",
    id: "fixture-listener-retrieve-long-identifier",
    flags: ["--retrieve"],
    artifactId:
      "dicoogle-next-service-fixture-listener-retrieve-long-identifier",
  },
];

const QUERY_INDEX_CASES = [
  { name: "ingest", id: "fixture-ing", flags: ["--ingest"] },
  { name: "query", id: "fixture-qry", flags: ["--query"] },
  { name: "move", id: "fixture-mv", flags: ["--move"] },
  {
    name: "maintenance",
    id: "fixture-mnt",
    flags: ["--maintenance"],
  },
  { name: "settings", id: "fixture-set", flags: ["--settings"] },
  {
    name: "all",
    id: "fixture-qall",
    flags: [
      "--ingest",
      "--query",
      "--move",
      "--maintenance",
      "--settings",
    ],
  },
  {
    name: "long-id",
    id: "fixture-query-index-long-ident",
    flags: [
      "--ingest",
      "--query",
      "--move",
      "--maintenance",
      "--settings",
    ],
  },
];

function parseArgs(argv) {
  const options = {
    repo:
      process.env.DICOOGLE_NEXT_REPO ??
      path.resolve(TOOL_ROOT, "..", "dicoogle-next"),
    workdir: null,
    keep: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: node scripts/build-fixtures.mjs " +
          "[--repo <dicoogle-next checkout>] " +
          "[--workdir <dir>] [--keep]",
      );
      process.exit(EXIT_CODES.OK);
    }

    if (argument === "--keep") {
      options.keep = true;
      continue;
    }

    if (argument !== "--repo" && argument !== "--workdir") {
      throw new UsageError(`unknown argument "${argument}"`);
    }

    const value = argv[index + 1];

    if (value === undefined) {
      throw new UsageError(`"${argument}" requires a value`);
    }

    if (argument === "--repo") {
      options.repo = path.resolve(value);
    } else {
      options.workdir = path.resolve(value);
    }

    index += 1;
  }

  return options;
}

function run(command, args, { cwd, label } = {}) {
  const display = [command, ...args].join(" ");
  console.log(
    `\n$ ${display}${cwd ? `  (cwd: ${cwd})` : ""}`,
  );

  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw new Error(
      `${label ?? display} could not start: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${label ?? display} exited with status ${result.status}`,
    );
  }

  return result;
}

function capture(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(
      `${command} could not start: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stderr}`,
    );
  }

  return result.stdout.trim();
}

function addModule(pomPath, modulePath) {
  const content = readFileSync(pomPath, "utf8");
  const marker = `<module>${modulePath}</module>`;

  if (content.includes(marker)) {
    return;
  }

  if (!content.includes("</modules>")) {
    throw new Error(`no </modules> in ${pomPath}`);
  }

  const updated = content.replace(
    "</modules>",
    `        ${marker}\n    </modules>`,
  );
  writeFileSync(pomPath, updated);
}

function addAppDependency(pomPath, artifactId) {
  const content = readFileSync(pomPath, "utf8");

  if (content.includes(`<artifactId>${artifactId}</artifactId>`)) {
    return;
  }

  const index = content.lastIndexOf("</dependencies>");

  if (index === -1) {
    throw new Error(`no </dependencies> in ${pomPath}`);
  }

  const dependency =
    "        <dependency>\n" +
    "            <groupId>org.dicoogle</groupId>\n" +
    `            <artifactId>${artifactId}</artifactId>\n` +
    "            <version>${project.version}</version>\n" +
    "        </dependency>\n";

  writeFileSync(
    pomPath,
    `${content.slice(0, index)}${dependency}${content.slice(index)}`,
  );
}

function walkFiles(directory, base = directory, output = []) {
  for (const entry of readdirSync(directory, {
    withFileTypes: true,
  })) {
    if (entry.name === "target" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkFiles(fullPath, base, output);
    } else {
      output.push(path.relative(base, fullPath));
    }
  }

  return output.sort();
}

function hashTree(directory) {
  const hashes = {};

  for (const relativePath of walkFiles(directory)) {
    hashes[relativePath] = createHash("sha256")
      .update(readFileSync(path.join(directory, relativePath)))
      .digest("hex");
  }

  return hashes;
}

function assertNoRewrite(before, after, label) {
  const files = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);
  const changed = [];

  for (const file of files) {
    if (before[file] !== after[file]) {
      changed.push(file);
    }
  }

  if (changed.length > 0) {
    throw new Error(
      `${label}: Spotless rewrote generated files:\n` +
        changed.map((file) => `  - ${file}`).join("\n"),
    );
  }
}

function runCase(
  family,
  testCase,
  {
    backendDir,
    mvnw,
    backendPom,
  },
) {
  const prefix =
    family === "storage"
      ? "dicoogle-next-storage"
      : family === "query-index"
        ? "dicoogle-next-query"
        : "dicoogle-next-listener";
  const artifactId =
    testCase.artifactId ?? `${prefix}-${testCase.id}`;
  const outputDir = path.join(backendDir, "plugins", artifactId);

  console.log(`\n=== ${family} case: ${testCase.name} ===`);

  run(
    process.execPath,
    [
      CLI,
      "java",
      "--id",
      testCase.id,
      "--family",
      family,
      ...testCase.flags,
      "--out",
      outputDir,
    ],
    { cwd: TOOL_ROOT },
  );

  addModule(backendPom, `plugins/${artifactId}`);

  run(
    mvnw,
    [
      "-B",
      "-ntp",
      "-pl",
      `plugins/${artifactId}`,
      "spotless:check",
    ],
    { cwd: backendDir },
  );

  const before = hashTree(outputDir);

  run(
    mvnw,
    ["-B", "-ntp", "-pl", `plugins/${artifactId}`, "test"],
    { cwd: backendDir },
  );

  const after = hashTree(outputDir);
  assertNoRewrite(before, after, testCase.name);

  console.log(
    `case ${testCase.name}: spotless:check + tests OK, no rewrite`,
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const lock = loadLock();
  const pin = lock.dicoogleNext;

  if (!pin.commit) {
    throw new Error("template lock has no pinned commit");
  }

  mkdirSync(options.workdir ?? tmpdir(), { recursive: true });
  const runRoot = mkdtempSync(
    path.join(options.workdir ?? tmpdir(), "dicoogle-plugin-fixtures-"),
  );
  const cloneDir = path.join(runRoot, "dicoogle-next");

  try {
    run(
      "git",
      [
        "clone",
        "--no-hardlinks",
        "--quiet",
        options.repo,
        cloneDir,
      ],
      { label: "git clone" },
    );
    run(
      "git",
      ["-C", cloneDir, "checkout", "--quiet", pin.commit],
      { label: "git checkout" },
    );

    const head = capture("git", [
      "-C",
      cloneDir,
      "rev-parse",
      "HEAD",
    ]);

    if (head !== pin.commit) {
      throw new Error(
        `checked out ${head}, expected ${pin.commit}`,
      );
    }

    const backendDir = path.join(cloneDir, "backend");
    const mvnw = path.join(backendDir, "mvnw");
    const backendPom = path.join(backendDir, "pom.xml");
    const appPom = path.join(
      backendDir,
      "dicoogle-next",
      "pom.xml",
    );

    run(
      mvnw,
      ["-B", "-ntp", "-N", "install", "-DskipTests"],
      { cwd: backendDir },
    );
    run(
      mvnw,
      [
        "-B",
        "-ntp",
        "-pl",
        "dicoogle-next-sdk",
        "-am",
        "install",
        "-DskipTests",
      ],
      { cwd: backendDir },
    );

    for (const testCase of STORAGE_CASES) {
      runCase("storage", testCase, {
        backendDir,
        mvnw,
        backendPom,
      });
    }

    for (const testCase of QUERY_INDEX_CASES) {
      runCase("query-index", testCase, {
        backendDir,
        mvnw,
        backendPom,
      });
    }

    for (const testCase of LISTENER_CASES) {
      runCase("listener", testCase, {
        backendDir,
        mvnw,
        backendPom,
      });
    }

    addAppDependency(
      appPom,
      "dicoogle-next-storage-fixture-all",
    );
    addAppDependency(
      appPom,
      "dicoogle-next-query-fixture-qall",
    );
    addAppDependency(
      appPom,
      "dicoogle-next-query-fixture-lst-ing",
    );
    addAppDependency(
      appPom,
      "dicoogle-next-service-fixture-lst-ret",
    );

    console.log("\n=== full reactor clean verify ===");
    run(mvnw, ["-B", "-ntp", "clean", "verify"], {
      cwd: backendDir,
    });

    console.log("\n=== standalone build outside the checkout ===");
    const standaloneOut = path.join(
      runRoot,
      "standalone",
      "dicoogle-next-storage-fixture-standalone",
    );
    run(
      process.execPath,
      [
        CLI,
        "java",
        "--id",
        "fixture-standalone",
        "--family",
        "storage",
        "--readable",
        "--writable",
        "--listable",
        "--locator",
        "--out",
        standaloneOut,
      ],
      { cwd: TOOL_ROOT },
    );
    run("mvn", ["-B", "-ntp", "spotless:check", "test"], {
      cwd: standaloneOut,
    });

    const queryStandaloneOut = path.join(
      runRoot,
      "standalone",
      "dicoogle-next-query-fixture-standalone",
    );
    run(
      process.execPath,
      [
        CLI,
        "java",
        "--id",
        "fixture-standalone-q",
        "--family",
        "query-index",
        "--ingest",
        "--query",
        "--move",
        "--maintenance",
        "--settings",
        "--out",
        queryStandaloneOut,
      ],
      { cwd: TOOL_ROOT },
    );
    run("mvn", ["-B", "-ntp", "spotless:check", "test"], {
      cwd: queryStandaloneOut,
    });

    for (const [kind, id] of [
      ["ingest", "fixture-std-ing"],
      ["retrieve", "fixture-std-ret"],
    ]) {
      const artifactId = `dicoogle-next-${kind === "ingest" ? "query" : "service"}-${id}`;
      const listenerStandaloneOut = path.join(
        runRoot,
        "standalone",
        artifactId,
      );
      run(
        process.execPath,
        [
          CLI,
          "java",
          "--id",
          id,
          "--family",
          "listener",
          `--${kind}`,
          "--out",
          listenerStandaloneOut,
        ],
        { cwd: TOOL_ROOT },
      );
      run("mvn", ["-B", "-ntp", "spotless:check", "test"], {
        cwd: listenerStandaloneOut,
      });
    }

    console.log(
      "\nAll storage, query-index, and listener fixture cases, full reactor, " +
        "and standalone builds passed.",
    );

    if (options.keep) {
      console.log(`kept work directory: ${runRoot}`);
    } else {
      rmSync(runRoot, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`\nwork directory kept for inspection: ${runRoot}`);
    throw error;
  }
}

try {
  main();
} catch (error) {
  const normalized = normalizeError(error);
  console.error(formatError(normalized));
  process.exitCode = normalized.exitCode ?? EXIT_CODES.INTERNAL;
}
