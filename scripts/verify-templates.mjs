#!/usr/bin/env node
import {
  EXIT_CODES,
  UsageError,
  formatError,
  normalizeError,
} from "../src/errors.mjs";
import { verifyLock } from "../src/lock.mjs";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: node scripts/verify-templates.mjs " +
          "[--lock <path>] [--templates <dir>]",
      );
      process.exit(EXIT_CODES.OK);
    }

    if (argument !== "--lock" && argument !== "--templates") {
      throw new UsageError(`unknown argument "${argument}"`);
    }

    const value = argv[index + 1];

    if (value === undefined) {
      throw new UsageError(`"${argument}" requires a value`);
    }

    options[argument === "--lock" ? "lockPath" : "templatesDir"] =
      value;
    index += 1;
  }

  return options;
}

try {
  const { lock, templates } = verifyLock(parseArgs(process.argv.slice(2)));
  const pin = lock.dicoogleNext;

  console.log(
    `template lock OK: ${pin.commit} (${pin.branchAtPin})`,
  );
  console.log(
    `  SDK ${pin.sdkVersion}; parent ${pin.parentVersion}; ` +
      `Java ${pin.javaVersion}; Maven ${pin.mavenMinimum}; ` +
      `Spring Boot ${pin.springBootVersion}; ` +
      `dcm4che ${pin.dcm4cheVersion}; web apiVersion ${pin.webApiVersion}`,
  );
  console.log(`  templates verified: ${templates.length}`);

  for (const template of templates) {
    const placeholders =
      template.placeholders.length === 0
        ? "(none)"
        : template.placeholders.join(", ");
    console.log(
      `  - ${template.path} sha256=${template.sha256} ` +
        `placeholders=${placeholders}`,
    );
  }
} catch (error) {
  const normalized = normalizeError(error);
  console.error(formatError(normalized));
  process.exitCode = normalized.exitCode ?? EXIT_CODES.INTERNAL;
}
