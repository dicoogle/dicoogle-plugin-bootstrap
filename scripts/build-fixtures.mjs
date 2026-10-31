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

const COLLISION_CASES = [
  {
    family: "storage",
    name: "storage-a",
    id: "collision-st-a",
    flags: ["--readable", "--writable", "--listable", "--locator"],
    artifactId: "dicoogle-next-storage-collision-st-a",
  },
  {
    family: "storage",
    name: "storage-b",
    id: "collision-st-b",
    flags: ["--readable", "--writable", "--listable", "--locator"],
    artifactId: "dicoogle-next-storage-collision-st-b",
  },
  {
    family: "storage",
    name: "same-package-foo-bar",
    id: "foo-bar",
    flags: ["--readable", "--writable", "--listable", "--locator"],
    artifactId: "dicoogle-next-storage-foo-bar",
  },
  {
    family: "storage",
    name: "same-package-foobar",
    id: "foobar",
    flags: ["--readable", "--writable", "--listable", "--locator"],
    artifactId: "dicoogle-next-storage-foobar",
  },
  {
    family: "query-index",
    name: "query-a",
    id: "collision-q-a",
    flags: [
      "--ingest",
      "--query",
      "--move",
      "--maintenance",
      "--settings",
    ],
    artifactId: "dicoogle-next-query-collision-q-a",
  },
  {
    family: "query-index",
    name: "query-b",
    id: "collision-q-b",
    flags: [
      "--ingest",
      "--query",
      "--move",
      "--maintenance",
      "--settings",
    ],
    artifactId: "dicoogle-next-query-collision-q-b",
  },
  {
    family: "listener",
    name: "ingest-a",
    id: "collision-ing-a",
    flags: ["--ingest"],
    artifactId: "dicoogle-next-query-collision-ing-a",
  },
  {
    family: "listener",
    name: "ingest-b",
    id: "collision-ing-b",
    flags: ["--ingest"],
    artifactId: "dicoogle-next-query-collision-ing-b",
  },
  {
    family: "listener",
    name: "retrieve-a",
    id: "collision-ret-a",
    flags: ["--retrieve"],
    artifactId: "dicoogle-next-service-collision-ret-a",
  },
  {
    family: "listener",
    name: "retrieve-b",
    id: "collision-ret-b",
    flags: ["--retrieve"],
    artifactId: "dicoogle-next-service-collision-ret-b",
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
    only: null,
    skipStandalone: false,
    skipFullReactor: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: node scripts/build-fixtures.mjs " +
          "[--repo <dicoogle-next checkout>] " +
          "[--workdir <dir>] [--only <case[,case]>] " +
          "[--skip-standalone] [--skip-full-reactor] [--keep]",
      );
      process.exit(EXIT_CODES.OK);
    }

    if (argument === "--keep") {
      options.keep = true;
      continue;
    }

    if (argument === "--skip-standalone") {
      options.skipStandalone = true;
      continue;
    }

    if (argument === "--skip-full-reactor") {
      options.skipFullReactor = true;
      continue;
    }

    if (argument !== "--repo" &&
        argument !== "--workdir" &&
        argument !== "--only") {
      throw new UsageError(`unknown argument "${argument}"`);
    }

    const value = argv[index + 1];

    if (value === undefined) {
      throw new UsageError(`"${argument}" requires a value`);
    }

    if (argument === "--repo") {
      options.repo = path.resolve(value);
    } else if (argument === "--workdir") {
      options.workdir = path.resolve(value);
    } else {
      const names = value.split(",").map((name) => name.trim()).filter(Boolean);

      if (names.includes("collision")) {
        const collisionNames = COLLISION_CASES.map((testCase) => testCase.name);
        options.only = new Set([
          ...names.filter((name) => name !== "collision"),
          ...collisionNames,
        ]);
      } else {
        options.only = new Set(names);
      }
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

function artifactIdForCase(family, testCase) {
  if (testCase.artifactId) {
    return testCase.artifactId;
  }

  const prefix =
    family === "storage"
      ? "dicoogle-next-storage"
      : family === "query-index"
        ? "dicoogle-next-query"
        : "dicoogle-next-listener";

  return `${prefix}-${testCase.id}`;
}

function runCase(
  family,
  testCase,
  {
    backendDir,
    mvnw,
    backendPom,
    appPom,
  },
) {
  const artifactId = artifactIdForCase(family, testCase);
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
  addAppDependency(appPom, artifactId);

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

function collisionProbeSource() {
  return `package org.dicoogle.app;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.dicoogle.app.config.ActiveStoragePlugins;
import org.dicoogle.core.query.QueryRouter;
import org.dicoogle.protocol.dicomweb.DicomwebRetrieveService;
import org.dicoogle.protocol.dimse.CStoreService;
import org.dicoogle.sdk.DicooglePlugin;
import org.dicoogle.sdk.query.StorageIngestEventListener;
import org.dicoogle.sdk.service.StorageRetrieveEventListener;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
    properties = {
      "app.storage.collision-st-a.enabled=true",
      "app.storage.collision-st-b.enabled=true",
      "app.storage.foo-bar.enabled=true",
      "app.storage.foobar.enabled=true",
      "app.query.collision-q-a.enabled=true",
      "app.query.collision-q-b.enabled=true",
      "app.query.collision-ing-a.enabled=true",
      "app.query.collision-ing-b.enabled=true",
      "app.service.collision-ret-a.enabled=true",
      "app.service.collision-ret-b.enabled=true",
      "app.query.lucene.enabled=false"
    })
@ActiveProfiles("test")
class BeanCollisionProbeTest {

  @Autowired private ActiveStoragePlugins activeStoragePlugins;
  @Autowired private QueryRouter queryRouter;
  @Autowired private CStoreService cStoreService;
  @Autowired private DicomwebRetrieveService dicomwebRetrieveService;

  @Test
  void twoStorageModulesCoexist() {
    List<String> ids =
        activeStoragePlugins.plugins().stream()
            .map(plugin -> plugin.metadata().id())
            .toList();

    System.out.println("COLLISION_STORAGE=" + ids);
    assertTrue(ids.containsAll(List.of("collision-st-a", "collision-st-b")), ids.toString());
  }

  @Test
  void samePackageStorageModulesCoexist() {
    List<String> ids =
        activeStoragePlugins.plugins().stream()
            .map(plugin -> plugin.metadata().id())
            .toList();

    System.out.println("SAME_PACKAGE_STORAGE=" + ids);
    assertTrue(ids.containsAll(List.of("foo-bar", "foobar")), ids.toString());
  }

  @Test
  void twoQueryIndexModulesCoexist() throws Exception {
    System.out.println("COLLISION_QUERY=" + mapKeys("queryServices"));
    System.out.println("COLLISION_MOVE=" + mapKeys("moveServices"));
    assertTrue(
        mapKeys("queryServices").containsAll(List.of("collision-q-a", "collision-q-b")),
        mapKeys("queryServices").toString());
    assertTrue(
        mapKeys("moveServices").containsAll(List.of("collision-q-a", "collision-q-b")),
        mapKeys("moveServices").toString());
  }

  @Test
  void twoIngestListenersCoexist() throws Exception {
    List<String> ids = fieldIds(cStoreService, "listeners");

    System.out.println("COLLISION_INGEST=" + ids);
    assertTrue(ids.containsAll(List.of("collision-ing-a", "collision-ing-b")), ids.toString());
  }

  @Test
  void twoRetrieveListenersCoexist() throws Exception {
    List<String> ids = fieldIds(dicomwebRetrieveService, "retrieveEventListeners");

    System.out.println("COLLISION_RETRIEVE=" + ids);
    assertTrue(ids.containsAll(List.of("collision-ret-a", "collision-ret-b")), ids.toString());
  }

  private List<String> mapKeys(String fieldName) throws Exception {
    Field field = QueryRouter.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    Map<String, ?> map = (Map<String, ?>) field.get(queryRouter);
    return map.keySet().stream().toList();
  }

  private List<String> fieldIds(Object target, String fieldName) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    List<?> values = (List<?>) field.get(target);

    return values.stream()
        .filter(value -> value instanceof DicooglePlugin)
        .map(value -> ((DicooglePlugin) value).metadata().id())
        .toList();
  }
}
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const selected = (name) => !options.only || options.only.has(name);
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

    for (const testCase of STORAGE_CASES.filter((testCase) => selected(testCase.name))) {
      runCase("storage", testCase, {
        backendDir,
        mvnw,
        backendPom,
        appPom,
      });
    }

    for (const testCase of QUERY_INDEX_CASES.filter((testCase) => selected(testCase.name))) {
      runCase("query-index", testCase, {
        backendDir,
        mvnw,
        backendPom,
        appPom,
      });
    }

    for (const testCase of LISTENER_CASES.filter((testCase) => selected(testCase.name))) {
      runCase("listener", testCase, {
        backendDir,
        mvnw,
        backendPom,
        appPom,
      });
    }

    for (const testCase of COLLISION_CASES.filter((testCase) => selected(testCase.name))) {
      runCase(testCase.family, testCase, {
        backendDir,
        mvnw,
        backendPom,
        appPom,
      });
    }

    const allCollisionSelected = COLLISION_CASES.every((testCase) =>
      selected(testCase.name),
    );

    if (allCollisionSelected) {
      const probePath = path.join(
        backendDir,
        "dicoogle-next",
        "src",
        "test",
        "java",
        "org",
        "dicoogle",
        "app",
        "BeanCollisionProbeTest.java",
      );
      mkdirSync(path.dirname(probePath), { recursive: true });
      writeFileSync(probePath, collisionProbeSource());
    }

    if (!options.skipFullReactor) {
      console.log("\n=== full reactor clean verify ===");
      run(mvnw, ["-B", "-ntp", "clean", "verify"], {
        cwd: backendDir,
      });
    }

    if (!options.skipStandalone) {
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

    }

    const completed = [
      "selected fixture cases",
      ...(options.skipFullReactor ? [] : ["full reactor"]),
      ...(options.skipStandalone ? [] : ["standalone builds"]),
    ];
    console.log(`\n${completed.join(", ")} passed.`);

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
