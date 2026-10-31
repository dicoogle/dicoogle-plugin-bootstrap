import { readFileSync } from "node:fs";

import { parseArgv, validateArgv } from "./args.mjs";
import {
  CliError,
  EXIT_CODES,
  UsageError,
  formatError,
  normalizeError,
} from "./errors.mjs";
import { formatDryRunTree, writePlan } from "./fs.mjs";
import { DEFAULT_TEMPLATES_DIR, loadLock } from "./lock.mjs";
import {
  buildListenerModel,
  buildQueryIndexModel,
  buildStorageModel,
} from "./model.mjs";
import { inspectParentPom } from "./parent.mjs";
import {
  buildListenerPlan,
  buildQueryIndexPlan,
  buildStoragePlan,
  materializePlan,
} from "./plan.mjs";
import {
  validateGenerationOptions,
  validateReservedPluginId,
} from "./validate.mjs";

const PACKAGE_JSON_URL = new URL("../package.json", import.meta.url);

const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_URL, "utf8"));

export const TOOL_VERSION = packageJson.version;

export const HELP_TEXT = `Usage: dicoogle-plugin-bootstrap <command> [flags]

Commands:
  init      Interactive wizard (not implemented)
  java      Generate a Java Maven module (storage implemented)
  web       Generate a web UI plugin folder (not implemented)
  list      Show families, web hooks, and template pin status
  version   Show tool, Node, and template-lock versions

Global flags:
  -h, --help      Show this help
      --no-color  Disable ANSI color
      --verbose   Print extra diagnostics

Common generation flags:
  --id <kebab>            Plugin id
  --name <name>           Display name
  --out <path>            Target directory
  --repo <path>           dicoogle-next checkout for id scanning
  --force                 Allow a non-empty target
  --dry-run               Print the file tree without writing
  --license <SPDX|none>   Optional one-line SPDX header
  --type <token>          Override the single metadata type token

Java flags:
  --family storage|query-index|listener
  storage:     --readable --writable --listable --locator
  query-index: --ingest --query --move --maintenance --settings
               query()/resolve() return empty until matching is implemented.
               warning: IndexSettingsController selects the FIRST QueryIndexSettings
               provider (IndexSettingsController.java:25-31). Currently Lucene wins
               because LuceneQueryConfig has @Order(0) (LuceneQueryConfig.java:16),
               but ordering is not a stable contract; keep at most one enabled.
  listener:    --ingest | --retrieve
  all Java modules default to enabled=false; set enabled: true to activate.
  reserved bundled ids (lucene, query-file-rw, storage-file-ro,
  storage-file-rw) exit 2.

Web flags:
  --hooks <a,b>       query-filter,result-options,result-batch,
                      result-renderer,sidebar-menu,route,settings
  --api-version <v>   Only "1" or "1.0"

Exit codes:
  0 success, 2 usage, 3 target not empty, 4 duplicate id,
  5 template error, 6 internal, 7 unsupported runtime, 130 interrupted
`;

export function assertSupportedNode(version = process.versions.node) {
  const major = Number.parseInt(
    String(version).replace(/^v/i, "").split(".")[0],
    10,
  );

  if (!Number.isInteger(major) || major < 20) {
    throw new CliError(
      `Node.js 20 or newer is required (found ${version}).`,
      { exitCode: EXIT_CODES.UNSUPPORTED_RUNTIME },
    );
  }

  return major;
}

export function installSigintHandler(target = process) {
  const handler = () => {
    target.exit(EXIT_CODES.SIGINT);
  };

  target.on("SIGINT", handler);
  return handler;
}

function lockLines(lock, label) {
  const pin = lock.dicoogleNext ?? {};
  const commit = pin.commit ?? "unknown commit";
  const branch = pin.branchAtPin ?? "unknown branch";

  return [
    `${label}: ${commit} (${branch})`,
    `  SDK ${pin.sdkVersion ?? "unknown"}`,
    `  parent ${pin.parentVersion ?? "unknown"}`,
    `  Java ${pin.javaVersion ?? "unknown"}, Maven ${pin.mavenMinimum ?? "unknown"}, Spring Boot ${pin.springBootVersion ?? "unknown"}, dcm4che ${pin.dcm4cheVersion ?? "unknown"}`,
    `  web apiVersion ${pin.webApiVersion ?? "unknown"}`,
  ];
}

function formatVersion(lock) {
  const lines = [
    `dicoogle-plugin-bootstrap ${TOOL_VERSION}`,
    `node ${process.versions.node}`,
    ...lockLines(lock, "template lock"),
  ];

  return `${lines.join("\n")}\n`;
}

function formatList(lock) {
  const lines = [
    `dicoogle-plugin-bootstrap ${TOOL_VERSION}`,
    "",
    "Java families:",
    "  storage      --readable --writable --listable --locator (default: --readable)",
    "  query-index  --ingest --query --move --maintenance --settings (--locator rejected)",
    "  listener     --ingest (app.query, query-index) | --retrieve (app.service, service)",
    "",
    "Web hooks:",
    "  query-filter, result-options, result-batch, result-renderer, sidebar-menu, route, settings",
    "",
    ...lockLines(lock, "Template lock"),
  ];

  return `${lines.join("\n")}\n`;
}

export async function main(
  argv = process.argv.slice(2),
  io = { stdout: process.stdout, stderr: process.stderr },
) {
  try {
    assertSupportedNode();

    const parsed = parseArgv(argv);
    validateArgv(parsed);

    if (parsed.help || parsed.command === null) {
      io.stdout.write(HELP_TEXT);
      return EXIT_CODES.OK;
    }

    const validated = validateGenerationOptions(parsed);

    for (const warning of validated.warnings) {
      io.stderr.write(`warning: ${warning}\n`);
    }

    if (parsed.command === "java" && parsed.flags.settings === true) {
      io.stderr.write(
        "warning: --settings adds a QueryIndexSettings provider. " +
          "IndexSettingsController selects the FIRST provider " +
          "(IndexSettingsController.java:25-31). Currently Lucene wins " +
          "because LuceneQueryConfig has @Order(0) " +
          "(LuceneQueryConfig.java:16), but bean ordering is not a stable " +
          "contract. If a generated provider is enabled, only the first " +
          "provider is exposed and mutated; keep at most one enabled.\n",
      );
    }

    switch (parsed.command) {
      case "version": {
        io.stdout.write(formatVersion(loadLock()));
        return EXIT_CODES.OK;
      }
      case "list": {
        io.stdout.write(formatList(loadLock()));
        return EXIT_CODES.OK;
      }
      case "java": {
        const lock = loadLock();
        validateReservedPluginId(
          validated.values.id,
          lock.reservedPluginIds,
        );
        const family = validated.values?.family;

        if (
          family !== "storage" &&
          family !== "query-index" &&
          family !== "listener"
        ) {
          io.stdout.write(
            `dicoogle-plugin-bootstrap: java generation for family ` +
              `"${family ?? "unknown"}" is not implemented yet ` +
              "(storage, query-index, and listener only).\n",
          );
          return EXIT_CODES.OK;
        }

        const model =
          family === "storage"
            ? buildStorageModel({
                flags: parsed.flags,
                values: validated.values,
              })
            : family === "query-index"
              ? buildQueryIndexModel({
                  flags: parsed.flags,
                  values: validated.values,
                })
              : buildListenerModel({
                  flags: parsed.flags,
                  values: validated.values,
                });
        inspectParentPom({ out: model.out, lock });
        const plan =
          family === "storage"
            ? buildStoragePlan(model, lock)
            : family === "query-index"
              ? buildQueryIndexPlan(model, lock)
              : buildListenerPlan(model, lock);
        const files = materializePlan(plan, {
          templatesDir: DEFAULT_TEMPLATES_DIR,
        });

        if (parsed.flags.dryRun === true) {
          io.stdout.write(
            formatDryRunTree({
              out: model.out,
              files: plan.files,
              force: parsed.flags.force === true,
            }),
          );
          return EXIT_CODES.OK;
        }

        const result = writePlan({
          out: model.out,
          files,
          force: parsed.flags.force === true,
        });

        io.stdout.write(
          `created ${files.length} file(s) in ${result.root}\n`,
        );
        return EXIT_CODES.OK;
      }
      case "init":
      case "web": {
        io.stdout.write(
          `dicoogle-plugin-bootstrap: ${parsed.command} generation is not implemented yet (storage, query-index, and listener implemented).\n`,
        );
        return EXIT_CODES.OK;
      }
      default: {
        throw new UsageError(`unknown command "${parsed.command}"`);
      }
    }
  } catch (error) {
    const normalized = normalizeError(error);
    io.stderr.write(`${formatError(normalized)}\n`);

    if (normalized.exitCode === EXIT_CODES.USAGE) {
      io.stderr.write(
        "Run 'dicoogle-plugin-bootstrap --help' for usage.\n",
      );
    }

    return normalized.exitCode;
  }
}
