import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { UsageError } from "./errors.mjs";

function escapeXmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertPomPackaging(content, pomPath) {
  if (!/<packaging>\s*pom\s*<\/packaging>/.test(content)) {
    throw new UsageError(
      `not a pom-packaging project: ${pomPath}. ` +
        "Expected <packaging>pom</packaging>.",
    );
  }
}

function parseParentCoordinates(content) {
  const parent = String(content).match(
    /<parent>([\s\S]*?)<\/parent>/,
  )?.[1];

  if (!parent) {
    return null;
  }

  return {
    groupId: parent.match(/<groupId>\s*([^<]+?)\s*<\/groupId>/)?.[1],
    artifactId: parent.match(/<artifactId>\s*([^<]+?)\s*<\/artifactId>/)?.[1],
    version: parent.match(/<version>\s*([^<]+?)\s*<\/version>/)?.[1],
  };
}

function lineStartIndex(content, index) {
  return content.lastIndexOf("\n", index - 1) + 1;
}

function leadingWhitespace(value) {
  return String(value).match(/^[ \t]*/)[0];
}

function detectLineEnding(content) {
  return String(content).includes("\r\n") ? "\r\n" : "\n";
}

function normalizeModulePath(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UsageError("module path must be a non-empty string.");
  }

  const normalized = value.trim().replaceAll("\\", "/");

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").includes("..") ||
    normalized.split("/").includes(".")
  ) {
    throw new UsageError(
      `invalid module path: ${JSON.stringify(value)}. ` +
        "Use a relative path such as plugins/my-plugin.",
    );
  }

  return normalized.replace(/\/+/g, "/").replace(/\/$/, "");
}

function moduleEntries(content) {
  return [
    ...String(content).matchAll(
      /<module\b[^>]*>([\s\S]*?)<\/module>/g,
    ),
  ].map((match) => match[1].trim());
}

function topLevelIndent(content) {
  const match = String(content).match(
    /\n([ \t]+)<(?:modelVersion|parent|groupId|artifactId|version|packaging|name|description)\b/,
  );

  return match?.[1] ?? "    ";
}

function insertModule(content, escapedModule, eol) {
  const selfClosing = content.match(/<modules\s*\/>/);

  if (selfClosing) {
    const lineStart = lineStartIndex(content, selfClosing.index);
    const indent = leadingWhitespace(
      content.slice(lineStart, selfClosing.index),
    );
    const block =
      `<modules>${eol}` +
      `${indent}    <module>${escapedModule}</module>${eol}` +
      `${indent}</modules>`;

    return (
      content.slice(0, selfClosing.index) +
      block +
      content.slice(selfClosing.index + selfClosing[0].length)
    );
  }

  const open = content.match(/<modules\b[^>]*>/);

  if (open) {
    const openIndex = open.index;
    const openEnd = openIndex + open[0].length;
    const closeIndex = content.indexOf("</modules>", openEnd);

    if (closeIndex === -1) {
      throw new UsageError(
        "project POM has an unclosed <modules> block.",
      );
    }

    const closeLineStart = lineStartIndex(content, closeIndex);
    const beforeClose = content.slice(closeLineStart, closeIndex);
    const closeOwnLine = /^[ \t]*$/.test(beforeClose);
    const block = content.slice(openEnd, closeIndex);
    const moduleIndents = [
      ...block.matchAll(/(?:^|\n)([ \t]+)<module\b/g),
    ].map((match) => match[1]);

    if (closeOwnLine) {
      const closingIndent = beforeClose;
      const moduleIndent = moduleIndents.length > 0
        ? moduleIndents[moduleIndents.length - 1]
        : `${closingIndent}    `;
      const insertion =
        `${moduleIndent}<module>${escapedModule}</module>${eol}`;

      return (
        content.slice(0, closeLineStart) +
        insertion +
        content.slice(closeLineStart)
      );
    }

    const openLineStart = lineStartIndex(content, openIndex);
    const openIndent = leadingWhitespace(
      content.slice(openLineStart, openIndex),
    );
    const moduleIndent = moduleIndents.length > 0
      ? moduleIndents[moduleIndents.length - 1]
      : `${openIndent}    `;
    const insertion =
      `${eol}${moduleIndent}<module>${escapedModule}</module>${eol}${openIndent}`;

    return (
      content.slice(0, closeIndex) +
      insertion +
      content.slice(closeIndex)
    );
  }

  const projectClose = content.lastIndexOf("</project>");

  if (projectClose === -1) {
    throw new UsageError(
      "project POM has no closing </project>.",
    );
  }

  const closeLineStart = lineStartIndex(content, projectClose);
  const beforeClose = content.slice(closeLineStart, projectClose);
  const closeOwnLine = /^[ \t]*$/.test(beforeClose);
  const indent = topLevelIndent(content);
  const block =
    `${indent}<modules>${eol}` +
    `${indent}    <module>${escapedModule}</module>${eol}` +
    `${indent}</modules>${eol}`;

  if (closeOwnLine) {
    return (
      content.slice(0, closeLineStart) +
      block +
      content.slice(closeLineStart)
    );
  }

  return (
    content.slice(0, projectClose) +
    `${eol}${block}` +
    content.slice(projectClose)
  );
}

export function inspectProjectPom({ project, lock }) {
  if (typeof project !== "string" || project.trim().length === 0) {
    throw new UsageError("--project must be a non-empty path.");
  }

  const projectRoot = path.resolve(project);
  let stats;

  try {
    stats = statSync(projectRoot);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new UsageError(
        `project root not found: ${projectRoot}. ` +
          "Run the \"init\" command first or pass the correct --project.",
      );
    }

    throw new UsageError(
      `cannot inspect project root ${projectRoot}: ${error.message}`,
    );
  }

  if (!stats.isDirectory()) {
    throw new UsageError(
      `project root is not a directory: ${projectRoot}.`,
    );
  }

  const projectPom = path.join(projectRoot, "pom.xml");
  let content;

  try {
    content = readFileSync(projectPom, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new UsageError(
        `project root POM not found: ${projectPom}. ` +
          "Run the \"init\" command first.",
      );
    }

    throw new UsageError(
      `cannot read project POM ${projectPom}: ${error.message}`,
    );
  }

  assertPomPackaging(content, projectPom);

  const found = parseParentCoordinates(content);
  const pin = lock.dicoogleNext;
  const expected = {
    groupId: pin.parentGroupId,
    artifactId: pin.parentArtifactId,
    version: pin.parentVersion,
  };

  if (
    !found ||
    found.groupId !== expected.groupId ||
    found.artifactId !== expected.artifactId ||
    found.version !== expected.version
  ) {
    throw new UsageError(
      `project POM parent mismatch at ${projectPom}: expected ` +
        `${expected.groupId}:${expected.artifactId}:${expected.version}, ` +
        `found ${found?.groupId ?? "?"}:${found?.artifactId ?? "?"}:` +
        `${found?.version ?? "?"}.`,
    );
  }

  return {
    projectRoot,
    projectPom,
    content,
  };
}

export function addModuleToProjectPom({ projectPom, module }) {
  if (typeof projectPom !== "string" || projectPom.trim().length === 0) {
    throw new UsageError("project POM path must be a non-empty string.");
  }

  const pomPath = path.resolve(projectPom);
  let content;

  try {
    content = readFileSync(pomPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new UsageError(`project POM not found: ${pomPath}.`);
    }

    throw new UsageError(
      `cannot read project POM ${pomPath}: ${error.message}`,
    );
  }

  assertPomPackaging(content, pomPath);

  const modulePath = normalizeModulePath(module);
  const escapedModule = escapeXmlText(modulePath);
  const existing = moduleEntries(content);

  if (
    existing.includes(modulePath) ||
    existing.includes(escapedModule)
  ) {
    return {
      projectPom: pomPath,
      module: modulePath,
      changed: false,
    };
  }

  const updated = insertModule(
    content,
    escapedModule,
    detectLineEnding(content),
  );

  writeFileSync(pomPath, updated, "utf8");

  return {
    projectPom: pomPath,
    module: modulePath,
    changed: true,
  };
}
