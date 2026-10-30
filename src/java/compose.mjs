import { TemplateRenderError, renderTemplate } from "../render.mjs";
import {
  storageClassFragments,
  storageTestFragments,
} from "./fragments/storage/index.mjs";

function unique(values) {
  return [...new Set(values)];
}

function renderString(value, data, templateName) {
  return renderTemplate(value, data, { name: templateName });
}

function renderLines(lines, data, templateName) {
  return (lines ?? []).map((line) =>
    renderString(line, data, templateName),
  );
}

function importSimpleName(importLine) {
  const withoutStatic = importLine.replace(/^static\s+/, "");
  return withoutStatic.split(".").pop();
}

function sortImports(imports) {
  const staticImports = imports
    .filter((entry) => entry.startsWith("static "))
    .sort();
  const normalImports = imports
    .filter((entry) => !entry.startsWith("static "))
    .sort();

  return { staticImports, normalImports };
}

function importBlock(imports) {
  const { staticImports, normalImports } = sortImports(imports);
  const lines = [];

  if (staticImports.length > 0) {
    lines.push(...staticImports.map((entry) => `import ${entry};`));
  }

  if (staticImports.length > 0 && normalImports.length > 0) {
    lines.push("");
  }

  if (normalImports.length > 0) {
    lines.push(...normalImports.map((entry) => `import ${entry};`));
  }

  return lines;
}

function indentLines(lines, spaces) {
  const prefix = " ".repeat(spaces);
  return lines.map((line) =>
    line.length === 0 ? "" : `${prefix}${line}`,
  );
}

function filterUsedImports(imports, body) {
  return imports.filter((entry) => {
    const simpleName = importSimpleName(entry);
    if (!simpleName) {
      return false;
    }

    return new RegExp(`\\b${simpleName}\\b`).test(body);
  });
}

function classDeclaration(className, interfaces) {
  if (interfaces.length === 0) {
    return [`public class ${className} {`];
  }

  if (interfaces.length === 1) {
    return [`public class ${className} implements ${interfaces[0]} {`];
  }

  return [
    `public class ${className}`,
    `    implements ${interfaces[0]},`,
    ...interfaces
      .slice(1)
      .map(
        (interfaceName, index) =>
          `        ${interfaceName}${index === interfaces.length - 2 ? " {" : ","}`,
      ),
  ];
}

function renderFields(fields, data, templateName) {
  return fields.flatMap((field) =>
    indentLines(
      renderString(field, data, templateName).split("\n"),
      2,
    ),
  );
}

function renderMethod(method, data, templateName) {
  const signature = renderString(
    method.signature,
    data,
    templateName,
  );
  const body = renderLines(method.body, data, templateName);
  const lines = [];

  if (method.override !== false) {
    lines.push("  @Override");
  }

  lines.push(`  ${signature} {`);
  lines.push(...indentLines(body, 4));
  lines.push("  }");

  return lines;
}

function renderConstructor(className, constructor, data, templateName) {
  if (!constructor) {
    return [];
  }

  const params = renderString(
    constructor.params,
    data,
    templateName,
  );
  const body = renderLines(constructor.body, data, templateName);

  return [
    `  public ${className}(${params}) {`,
    ...indentLines(body, 4),
    "  }",
  ];
}

function joinSections(sections) {
  const nonEmpty = sections.filter((section) => section.length > 0);
  const lines = [];

  nonEmpty.forEach((section, index) => {
    if (index > 0) {
      lines.push("");
    }
    lines.push(...section);
  });

  return `${lines.join("\n")}\n`;
}

function composeJavaClass({
  className,
  packageName,
  licenseHeader,
  interfaces,
  imports,
  fields,
  constructor,
  methods,
  data,
  templateName,
}) {
  const renderedFields = renderFields(fields, data, templateName);
  const renderedMethods = methods.map((method) =>
    renderMethod(method, data, templateName),
  );
  const flatMethods = renderedMethods.flatMap((lines, index) =>
    index === 0 ? lines : ["", ...lines],
  );
  const renderedConstructor = renderConstructor(
    className,
    constructor,
    data,
    templateName,
  );
  const declaration = classDeclaration(className, interfaces);
  const body = [
    ...renderedFields,
    ...renderedConstructor,
    ...flatMethods,
  ].join("\n");
  const usedImports = filterUsedImports(
    unique(imports),
    `${declaration.join("\n")}\n${body}`,
  );
  const header = [];

  if (licenseHeader) {
    header.push(licenseHeader, "");
  }

  header.push(`package ${packageName};`);

  const importsBlock = importBlock(usedImports);

  if (importsBlock.length > 0) {
    header.push("", ...importsBlock);
  }

  const classBody = [];

  if (renderedFields.length > 0) {
    classBody.push(...renderedFields);
  }

  if (renderedConstructor.length > 0) {
    if (classBody.length > 0) {
      classBody.push("");
    }
    classBody.push(...renderedConstructor);
  }

  if (flatMethods.length > 0) {
    if (classBody.length > 0) {
      classBody.push("");
    }
    classBody.push(...flatMethods);
  }

  const classLines = [...declaration, "", ...classBody, "}"];

  return joinSections([header, classLines]);
}

function composeTestClass({
  className,
  packageName,
  licenseHeader,
  imports,
  fields,
  tests,
  data,
  templateName,
}) {
  const renderedFields = renderFields(fields, data, templateName);
  const renderedTests = tests.map((test) => {
    const body = renderLines(test.body, data, templateName);
    return [
      "  @Test",
      `  void ${test.name}() throws Exception {`,
      ...indentLines(body, 4),
      "  }",
    ];
  });
  const declaration = [`class ${className} {`];
  const flatTests = renderedTests.flatMap((lines, index) =>
    index === 0 ? lines : ["", ...lines],
  );
  const body = [...renderedFields, ...flatTests].join("\n");
  const usedImports = filterUsedImports(
    unique(imports),
    `${declaration.join("\n")}\n${body}`,
  );
  const header = [];

  if (licenseHeader) {
    header.push(licenseHeader, "");
  }

  header.push(`package ${packageName};`);

  const importsBlock = importBlock(usedImports);

  if (importsBlock.length > 0) {
    header.push("", ...importsBlock);
  }

  const classBody = [];

  if (renderedFields.length > 0) {
    classBody.push(...renderedFields);
  }

  if (flatTests.length > 0) {
    if (classBody.length > 0) {
      classBody.push("");
    }
    classBody.push(...flatTests);
  }

  const classLines = [...declaration, "", ...classBody, "}"];

  return joinSections([header, classLines]);
}

export function composeStorageClass(model, data) {
  const fragments = storageClassFragments(model);
  const imports = fragments.flatMap((fragment) => fragment.imports ?? []);
  const fields = fragments.flatMap((fragment) => fragment.fields ?? []);
  const methods = fragments.flatMap((fragment) => fragment.methods ?? []);
  const constructor = fragments.find(
    (fragment) => fragment.constructor,
  )?.constructor;

  return composeJavaClass({
    className: model.className,
    packageName: model.package,
    licenseHeader: data.licenseHeader,
    interfaces: model.interfaces,
    imports,
    fields,
    constructor,
    methods,
    data,
    templateName: `storage class ${model.className}`,
  });
}

export function composeStorageTest(model, data) {
  const fragments = storageTestFragments(model);
  const imports = fragments.flatMap(
    (fragment) => fragment.testImports ?? [],
  );
  const fields = fragments.flatMap(
    (fragment) => fragment.testFields ?? [],
  );
  const tests = fragments.flatMap((fragment) => fragment.tests ?? []);

  return composeTestClass({
    className: `${model.className}Test`,
    packageName: model.package,
    licenseHeader: data.licenseHeader,
    imports,
    fields,
    tests,
    data,
    templateName: `storage test ${model.className}Test`,
  });
}

function countCharacter(content, character) {
  return content.split(character).length - 1;
}

function assertBalanced(content, open, close, label) {
  const openCount = countCharacter(content, open);
  const closeCount = countCharacter(content, close);

  if (openCount !== closeCount) {
    throw new TemplateRenderError(
      `unbalanced ${label} in generated Java source ` +
        `(${openCount} "${open}", ${closeCount} "${close}")`,
    );
  }
}

export function validateJavaSource({
  content,
  expectedPackage,
  expectedType,
  expectedMethods = [],
  interfaces = [],
}) {
  const source = String(content);

  if (source.includes("{{") || source.includes("}}")) {
    throw new TemplateRenderError(
      `unrendered template token in ${expectedType}`,
    );
  }

  if (source.includes("\r")) {
    throw new TemplateRenderError(
      `generated Java source contains CR line endings: ${expectedType}`,
    );
  }

  if (!source.endsWith("\n")) {
    throw new TemplateRenderError(
      `generated Java source must end with a newline: ${expectedType}`,
    );
  }

  const packageMatch = source.match(/^package\s+([\w.]+);/m);

  if (!packageMatch || packageMatch[1] !== expectedPackage) {
    throw new TemplateRenderError(
      `package declaration mismatch: expected ${expectedPackage}`,
    );
  }

  const typeMatches = [
    ...source.matchAll(
      /^(?:public\s+)?(?:class|interface|record|enum)\s+(\w+)/gm,
    ),
  ];

  if (typeMatches.length !== 1) {
    throw new TemplateRenderError(
      `expected exactly one top-level type in ${expectedType}, ` +
        `found ${typeMatches.length}`,
    );
  }

  if (typeMatches[0][1] !== expectedType) {
    throw new TemplateRenderError(
      `top-level type mismatch: expected ${expectedType}, ` +
        `found ${typeMatches[0][1]}`,
    );
  }

  assertBalanced(source, "{", "}", "braces");
  assertBalanced(source, "(", ")", "parentheses");
  assertBalanced(source, "<", ">", "angle brackets");

  const importLines = [
    ...source.matchAll(/^import\s+(?:static\s+)?([\w.]+);/gm),
  ].map((match) => match[1]);
  const bodyWithoutImports = source.replace(
    /^import\s+(?:static\s+)?[\w.]+;\n?/gm,
    "",
  );

  for (const importName of importLines) {
    const simpleName = importName.split(".").pop();

    if (
      simpleName &&
      !new RegExp(`\\b${simpleName}\\b`).test(bodyWithoutImports)
    ) {
      throw new TemplateRenderError(
        `unused import "${importName}" in ${expectedType}`,
      );
    }
  }

  for (const method of expectedMethods) {
    if (!new RegExp(`\\b${method}\\s*\\(`).test(source)) {
      throw new TemplateRenderError(
        `missing required method "${method}" in ${expectedType}`,
      );
    }
  }

  if (interfaces.length > 0) {
    const declaration = source.slice(
      source.indexOf(`class ${expectedType}`),
    );

    for (const interfaceName of interfaces) {
      if (!declaration.includes(interfaceName)) {
        throw new TemplateRenderError(
          `missing interface "${interfaceName}" in ${expectedType}`,
        );
      }
    }
  }

  return source;
}
