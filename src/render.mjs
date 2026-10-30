import { CliError, EXIT_CODES } from "./errors.mjs";
import {
  BLOCK_HELPERS,
  tokenizeTemplate,
} from "./template-syntax.mjs";

export class TemplateRenderError extends CliError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      exitCode: EXIT_CODES.TEMPLATE,
    });
    this.name = "TemplateRenderError";
  }
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasKey(data, key) {
  return (
    data !== null &&
    typeof data === "object" &&
    Object.prototype.hasOwnProperty.call(data, key)
  );
}

function getValue(data, key, templateName) {
  if (!hasKey(data, key)) {
    throw new TemplateRenderError(
      `unknown variable "${key}" in ${templateName}`,
    );
  }

  return data[key];
}

function renderValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function findMatchingClose(tokens, openIndex, helper, templateName) {
  let depth = 1;

  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token.type === "open") {
      depth += 1;
    } else if (token.type === "close") {
      depth -= 1;

      if (depth === 0) {
        if (token.name !== helper) {
          throw new TemplateRenderError(
            `mismatched block close "{{/${token.name}}}" for ` +
              `"{{#${helper}}}" in ${templateName}`,
          );
        }

        return index;
      }
    }
  }

  throw new TemplateRenderError(
    `unmatched block "{{#${helper}}}" in ${templateName}`,
  );
}

function renderRange(tokens, startIndex, expectedClose, data, templateName) {
  let output = "";
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.type === "close") {
      if (expectedClose === undefined) {
        throw new TemplateRenderError(
          `unmatched block close "{{/${token.name}}}" in ${templateName}`,
        );
      }

      if (token.name !== expectedClose) {
        throw new TemplateRenderError(
          `mismatched block close "{{/${token.name}}}" for ` +
            `"{{#${expectedClose}}}" in ${templateName}`,
        );
      }

      return { output, nextIndex: index + 1 };
    }

    if (token.type === "else") {
      throw new TemplateRenderError(
        `"{{else}}" blocks are not supported in ${templateName}`,
      );
    }

    if (token.type === "text") {
      output += token.value;
      index += 1;
      continue;
    }

    if (token.type === "variable") {
      output += renderValue(
        getValue(data, token.name, templateName),
      );
      index += 1;
      continue;
    }

    if (token.type === "open") {
      if (!BLOCK_HELPERS.includes(token.helper)) {
        throw new TemplateRenderError(
          `unsupported block helper "${token.helper}" in ${templateName}`,
        );
      }

      if (!token.key) {
        throw new TemplateRenderError(
          `block "{{#${token.helper}}}" requires a key in ${templateName}`,
        );
      }

      const value = getValue(data, token.key, templateName);

      if (token.helper === "each") {
        if (!Array.isArray(value)) {
          throw new TemplateRenderError(
            `"{{#each ${token.key}}}" expects an array in ` +
              templateName,
          );
        }

        const closeIndex = findMatchingClose(
          tokens,
          index,
          token.helper,
          templateName,
        );

        for (const item of value) {
          const childData = isObject(item)
            ? { ...data, ...item, this: item }
            : { ...data, this: item };

          output += renderRange(
            tokens,
            index + 1,
            token.helper,
            childData,
            templateName,
          ).output;
        }

        index = closeIndex + 1;
        continue;
      }

      const closeIndex = findMatchingClose(
        tokens,
        index,
        token.helper,
        templateName,
      );
      const truthy = Boolean(value);
      const shouldRender =
        token.helper === "if" ? truthy : !truthy;

      if (shouldRender) {
        output += renderRange(
          tokens,
          index + 1,
          token.helper,
          data,
          templateName,
        ).output;
      }

      index = closeIndex + 1;
      continue;
    }

    throw new TemplateRenderError(
      `unsupported template token in ${templateName}`,
    );
  }

  if (expectedClose !== undefined) {
    throw new TemplateRenderError(
      `unmatched block "{{#${expectedClose}}}" in ${templateName}`,
    );
  }

  return { output, nextIndex: index };
}

export function renderTemplate(
  content,
  data,
  { name = "template" } = {},
) {
  const tokens = tokenizeTemplate(content);
  return renderRange(tokens, 0, undefined, data ?? {}, name).output;
}
