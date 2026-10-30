import {
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { CliError, EXIT_CODES, UsageError } from "./errors.mjs";

export class TargetError extends CliError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      exitCode: EXIT_CODES.TARGET_NOT_EMPTY,
    });
    this.name = "TargetError";
  }
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    relativePath.split("/").includes("..") ||
    relativePath.split("/").includes(".")
  ) {
    throw new UsageError(
      `invalid output path: ${String(relativePath)}`,
    );
  }
}

function assertNoSymlinkComponents(root, relativePath) {
  let current = root;

  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);

    let stats;

    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }

      throw new UsageError(
        `cannot inspect output path ${current}: ${error.message}`,
      );
    }

    if (stats.isSymbolicLink()) {
      throw new UsageError(
        `refusing to write through symlink: ${current}`,
      );
    }
  }
}

export function inspectTarget({ out, force = false }) {
  if (typeof out !== "string" || out.trim().length === 0) {
    throw new UsageError("--out must be a non-empty path.");
  }

  const root = path.resolve(out);
  const parsed = path.parse(root);

  if (root === parsed.root) {
    throw new UsageError(
      "refusing to use the filesystem root as --out.",
    );
  }

  let stats;

  try {
    stats = lstatSync(root);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { root, exists: false, nonEmpty: false };
    }

    throw new UsageError(
      `cannot inspect --out ${out}: ${error.message}`,
    );
  }

  if (stats.isSymbolicLink()) {
    throw new UsageError(
      `refusing to use a symlink as --out: ${out}`,
    );
  }

  if (!stats.isDirectory()) {
    throw new UsageError(
      `--out must be a directory or a new path; ` +
        `refusing to use a regular file: ${out}`,
    );
  }

  let entries;

  try {
    entries = readdirSync(root);
  } catch (error) {
    throw new UsageError(
      `cannot read --out ${out}: ${error.message}`,
    );
  }

  if (entries.length > 0 && !force) {
    throw new TargetError(
      `target directory is not empty: ${out}. ` +
        "Use --force to proceed.",
    );
  }

  return {
    root,
    exists: true,
    nonEmpty: entries.length > 0,
  };
}

export function writePlan({ out, files, force = false }) {
  const target = inspectTarget({ out, force });

  for (const file of files) {
    assertSafeRelativePath(file.path);

    const absolutePath = path.resolve(target.root, file.path);

    if (
      absolutePath !== target.root &&
      !absolutePath.startsWith(`${target.root}${path.sep}`)
    ) {
      throw new UsageError(
        `output path escapes --out: ${file.path}`,
      );
    }

    assertNoSymlinkComponents(target.root, file.path);
    mkdirSync(path.dirname(absolutePath), { recursive: true });

    try {
      writeFileSync(absolutePath, file.content, {
        encoding: "utf8",
        flag: force ? "w" : "wx",
      });
    } catch (error) {
      if (error && error.code === "EEXIST") {
        throw new TargetError(
          `generated path already exists: ${file.path}. ` +
            "Use --force to overwrite.",
        );
      }

      throw new CliError(
        `cannot write ${file.path}: ${error.message}`,
        { exitCode: EXIT_CODES.INTERNAL, cause: error },
      );
    }
  }

  return {
    root: target.root,
    written: files.map((file) => file.path),
  };
}

export function formatDryRunTree({ out, files, force = false }) {
  const target = inspectTarget({ out, force });
  const rootName = path.basename(target.root) || target.root;
  const lines = [
    `${rootName}/`,
    ...files.map((file) => `  ${file.path}`),
  ];

  return `${lines.join("\n")}\n`;
}
