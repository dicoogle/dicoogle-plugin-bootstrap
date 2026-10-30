import { readFileSync } from "node:fs";
import path from "node:path";

import { TemplateLockError, DEFAULT_TEMPLATES_DIR } from "./lock.mjs";
import { renderTemplate } from "./render.mjs";
import {
  composeStorageClass,
  composeStorageTest,
  validateJavaSource,
} from "./java/compose.mjs";
import { expectedStorageMethods } from "./java/fragments/storage/index.mjs";

export function buildStorageData(model, lock) {
  const pin = lock.dicoogleNext;

  return {
    ...model,
    ...pin,
    capabilities: model.capabilities,
    readable: model.readable,
    writable: model.writable,
    listable: model.listable,
    locator: model.locator,
    licenseHeader: model.licenseHeader,
    licenseSpdx: model.license ?? "",
    enabledDefault: model.enabledDefault,
    matchIfMissing: model.matchIfMissing,
    ClassName: model.className,
    className: model.className,
  };
}

export function buildStoragePlan(model, lock) {
  const data = buildStorageData(model, lock);
  const mainClassPath =
    `src/main/java/${model.packagePath}/${model.className}.java`;
  const testClassPath =
    `src/test/java/${model.packagePath}/${model.className}Test.java`;
  const files = [
    {
      path: "pom.xml",
      kind: "template",
      template: "java/storage/pom.xml.tmpl",
      data,
    },
    {
      path: "README.md",
      kind: "template",
      template: "java/storage/README.md.tmpl",
      data,
    },
    {
      path: mainClassPath,
      kind: "storage-class",
      data,
    },
    {
      path: `src/main/java/${model.packagePath}/${model.className}Config.java`,
      kind: "template",
      template: "java/storage/config.java.tmpl",
      data,
    },
    {
      path: `src/main/java/${model.packagePath}/${model.className}Properties.java`,
      kind: "template",
      template: "java/storage/properties.java.tmpl",
      data,
    },
    {
      path: testClassPath,
      kind: "storage-test",
      data,
    },
  ];

  return {
    root: model.out,
    family: "storage",
    model,
    lock,
    data,
    files,
  };
}

function readTemplateFile(templatesDir, templatePath) {
  try {
    return readFileSync(
      path.join(templatesDir, templatePath),
      "utf8",
    );
  } catch (error) {
    throw new TemplateLockError(
      `template file cannot be read: ${templatePath}`,
      { cause: error },
    );
  }
}

function validatePlanPaths(files) {
  const seen = new Set();

  for (const file of files) {
    if (
      typeof file.path !== "string" ||
      file.path.length === 0 ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      file.path.split("/").includes("..") ||
      file.path.split("/").includes(".")
    ) {
      throw new TemplateLockError(
        `invalid generated path: ${String(file.path)}`,
      );
    }

    if (seen.has(file.path)) {
      throw new TemplateLockError(
        `duplicate generated path: ${file.path}`,
      );
    }

    seen.add(file.path);
  }
}

function validateMaterializedPlan(plan, files) {
  validatePlanPaths(files);

  for (const file of files) {
    const content = String(file.content);

    if (content.includes("{{") || content.includes("}}")) {
      throw new TemplateLockError(
        `unrendered template token in ${file.path}`,
      );
    }

    if (content.includes("\r")) {
      throw new TemplateLockError(
        `generated file contains CR line endings: ${file.path}`,
      );
    }

    if (!content.endsWith("\n")) {
      throw new TemplateLockError(
        `generated file must end with a newline: ${file.path}`,
      );
    }

    if (!file.path.endsWith(".java")) {
      continue;
    }

    const expectedType = path.posix.basename(file.path, ".java");
    const isTest = file.path.startsWith("src/test/java/");
    const expectedRoot = isTest
      ? `src/test/java/${plan.model.packagePath}/`
      : `src/main/java/${plan.model.packagePath}/`;

    if (!file.path.startsWith(expectedRoot)) {
      throw new TemplateLockError(
        `generated Java path does not match package: ${file.path}`,
      );
    }

    if (file.path !== `${expectedRoot}${expectedType}.java`) {
      throw new TemplateLockError(
        `generated Java file name does not match type: ${file.path}`,
      );
    }

    if (isTest && !expectedType.endsWith("Test")) {
      throw new TemplateLockError(
        `generated test class must end with Test: ${expectedType}`,
      );
    }

    const isMainClass = file.kind === "storage-class";

    validateJavaSource({
      content,
      expectedPackage: plan.model.package,
      expectedType,
      expectedMethods: isMainClass
        ? expectedStorageMethods(plan.model)
        : [],
      interfaces: isMainClass ? plan.model.interfaces : [],
    });
  }
}

export function materializePlan(
  plan,
  { templatesDir = DEFAULT_TEMPLATES_DIR } = {},
) {
  validatePlanPaths(plan.files);

  const files = plan.files.map((entry) => {
    let content;

    if (entry.kind === "template") {
      const template = readTemplateFile(
        templatesDir,
        entry.template,
      );
      content = renderTemplate(template, entry.data, {
        name: entry.template,
      });
    } else if (entry.kind === "storage-class") {
      content = composeStorageClass(plan.model, entry.data);
    } else if (entry.kind === "storage-test") {
      content = composeStorageTest(plan.model, entry.data);
    } else {
      throw new TemplateLockError(
        `unknown plan entry kind "${entry.kind}" for ${entry.path}`,
      );
    }

    return { path: entry.path, content };
  });

  validateMaterializedPlan(plan, files);
  return files;
}
