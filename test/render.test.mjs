import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { EXIT_CODES } from "../src/errors.mjs";
import {
  DEFAULT_TEMPLATES_DIR,
  TemplateLockError,
  loadLock,
  verifyTemplates,
} from "../src/lock.mjs";
import {
  buildListenerData,
  buildQueryIndexData,
  buildStorageData,
} from "../src/plan.mjs";
import {
  TemplateRenderError,
  renderTemplate,
} from "../src/render.mjs";
import {
  extractPlaceholders,
  tokenizeTemplate,
} from "../src/template-syntax.mjs";
import {
  listenerModel,
  queryIndexModel,
  storageModel,
} from "./helpers.mjs";

test("renderer interpolates variables", () => {
  assert.equal(
    renderTemplate("Hello {{name}}!", { name: "World" }),
    "Hello World!",
  );
  assert.equal(
    renderTemplate("{{ name }}", { name: "Spaced" }),
    "Spaced",
  );
  assert.equal(renderTemplate("{{value}}", { value: null }), "");
  assert.equal(renderTemplate("{{value}}", { value: false }), "false");
});

test("renderer supports if and unless", () => {
  assert.equal(
    renderTemplate("{{#if flag}}yes{{/if}}", { flag: true }),
    "yes",
  );
  assert.equal(
    renderTemplate("{{#if flag}}yes{{/if}}", { flag: false }),
    "",
  );
  assert.equal(
    renderTemplate("{{#unless flag}}no{{/unless}}", { flag: false }),
    "no",
  );
  assert.equal(
    renderTemplate("{{#unless flag}}no{{/unless}}", { flag: true }),
    "",
  );
});

test("renderer supports each with this and object items", () => {
  assert.equal(
    renderTemplate(
      "{{#each items}}[{{this}}]{{/each}}",
      { items: ["a", "b"] },
    ),
    "[a][b]",
  );
  assert.equal(
    renderTemplate(
      "{{#each items}}{{name}};{{/each}}",
      { items: [{ name: "a" }, { name: "b" }] },
    ),
    "a;b;",
  );
});

test("renderer supports nested blocks", () => {
  assert.equal(
    renderTemplate(
      "{{#if outer}}{{#each items}}{{#if this}}{{this}}{{/if}}{{/each}}{{/if}}",
      { outer: true, items: [1, 0, 2] },
    ),
    "12",
  );
});

test("renderer rejects unknown variables with exit 5", () => {
  assert.throws(
    () => renderTemplate("{{missing}}", {}),
    (error) =>
      error instanceof TemplateRenderError &&
      error.exitCode === EXIT_CODES.TEMPLATE &&
      /unknown variable "missing"/.test(error.message),
  );
});

test("renderer rejects unmatched and mismatched blocks with exit 5", () => {
  const cases = [
    "{{#if flag}}",
    "{{/if}}",
    "{{#if flag}}{{/unless}}",
    "{{#each items}}",
    "{{else}}",
    "{{#unknown key}}x{{/unknown}}",
  ];

  for (const template of cases) {
    assert.throws(
      () =>
        renderTemplate(template, {
          flag: true,
          items: [],
          key: true,
        }),
      (error) =>
        error instanceof TemplateRenderError &&
        error.exitCode === EXIT_CODES.TEMPLATE,
      template,
    );
  }
});

test("renderer rejects a non-array each value", () => {
  assert.throws(
    () =>
      renderTemplate("{{#each items}}{{this}}{{/each}}", {
        items: "not-array",
      }),
    (error) =>
      error instanceof TemplateRenderError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );
});

test("tokenizer and placeholder extractor are shared", () => {
  const tokens = tokenizeTemplate(
    "id={{id}} {{#if flag}}{{flag}}{{/if}}{{#each items}}{{this}}{{/each}}",
  );

  assert.deepEqual(
    tokens.map((token) => token.type),
    [
      "text",
      "variable",
      "text",
      "open",
      "variable",
      "close",
      "open",
      "variable",
      "close",
    ],
  );
  assert.deepEqual(
    extractPlaceholders(
      "id={{id}} {{#if flag}}{{flag}}{{/if}}{{#each items}}{{this}}{{/each}}",
    ),
    ["flag", "id", "items", "this"],
  );
});

test("every verified template renders with its full data object", () => {
  const lock = loadLock();
  const storageData = buildStorageData(
    storageModel({
      readable: true,
      writable: true,
      listable: true,
      locator: true,
    }),
    lock,
  );
  const queryData = buildQueryIndexData(
    queryIndexModel({
      ingest: true,
      query: true,
      move: true,
      maintenance: true,
      settings: true,
    }),
    lock,
  );
  const listenerData = buildListenerData(
    listenerModel({ ingest: true }),
    lock,
  );

  for (const templatePath of Object.keys(lock.templates)) {
    const content = readFileSync(
      path.join(DEFAULT_TEMPLATES_DIR, templatePath),
      "utf8",
    );
    const data = templatePath.startsWith("java/query-index/")
      ? queryData
      : templatePath.startsWith("java/listener/")
        ? listenerData
        : storageData;
    const rendered = renderTemplate(content, data, {
      name: templatePath,
    });

    assert.equal(typeof rendered, "string");
    assert.ok(rendered.length > 0);
  }
});

test("an undeclared placeholder fails in both renderer and verifier", (t) => {
  assert.throws(
    () => renderTemplate("{{undeclared}}", {}),
    (error) =>
      error instanceof TemplateRenderError &&
      error.exitCode === EXIT_CODES.TEMPLATE,
  );

  const templatesDir = mkdtempSync(
    path.join(tmpdir(), "dicoogle-template-syntax-"),
  );
  t.after(() => rmSync(templatesDir, { recursive: true, force: true }));

  const content = "{{undeclared}}\n";
  const templatePath = path.join(templatesDir, "bad.tmpl");
  writeFileSync(templatePath, content);

  const lock = {
    templates: {
      "bad.tmpl": {
        source: "test",
        sha256: createHash("sha256").update(content).digest("hex"),
        placeholders: [],
      },
    },
  };

  assert.throws(
    () => verifyTemplates(lock, { templatesDir }),
    (error) =>
      error instanceof TemplateLockError &&
      error.exitCode === EXIT_CODES.TEMPLATE &&
      /undeclared placeholder/.test(error.message),
  );
});
