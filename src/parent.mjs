import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { UsageError } from "./errors.mjs";

function parseProjectCoordinates(content) {
  const withoutParent = String(content).replace(
    /<parent>[\s\S]*?<\/parent>/,
    "",
  );
  const groupId = withoutParent.match(
    /<groupId>\s*([^<]+?)\s*<\/groupId>/,
  )?.[1];
  const artifactId = withoutParent.match(
    /<artifactId>\s*([^<]+?)\s*<\/artifactId>/,
  )?.[1];
  const version = withoutParent.match(
    /<version>\s*([^<]+?)\s*<\/version>/,
  )?.[1];

  return { groupId, artifactId, version };
}

export function inspectParentPom({ out, lock }) {
  const parentPath = path.resolve(out, "../../pom.xml");
  let stats;

  try {
    stats = statSync(parentPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        mode: "standalone",
        parentPath: null,
      };
    }

    throw new UsageError(
      `cannot inspect parent POM at ${parentPath}: ${error.message}`,
    );
  }

  if (!stats.isFile()) {
    throw new UsageError(
      `parent POM path is not a file: ${parentPath}`,
    );
  }

  const content = readFileSync(parentPath, "utf8");
  const found = parseProjectCoordinates(content);
  const pin = lock.dicoogleNext;
  const expected = {
    groupId: pin.parentGroupId,
    artifactId: pin.parentArtifactId,
    version: pin.parentVersion,
  };

  if (
    found.groupId !== expected.groupId ||
    found.artifactId !== expected.artifactId ||
    found.version !== expected.version
  ) {
    throw new UsageError(
      `conflicting parent POM at ${parentPath}: expected ` +
        `${expected.groupId}:${expected.artifactId}:${expected.version}, ` +
        `found ${found.groupId ?? "?"}:${found.artifactId ?? "?"}:` +
        `${found.version ?? "?"}. Choose another --out or remove the ` +
        "conflicting POM.",
    );
  }

  return {
    mode: "in-repo",
    parentPath,
    groupId: found.groupId,
    artifactId: found.artifactId,
    version: found.version,
  };
}
