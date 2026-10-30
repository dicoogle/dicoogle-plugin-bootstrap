export const BLOCK_HELPERS = Object.freeze(["if", "unless", "each"]);
export const PLACEHOLDER_NAME_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_.-]*$/;

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const BLOCK_HELPER_SET = new Set(BLOCK_HELPERS);

export function tokenizeTemplate(content) {
  const source = String(content);
  const tokens = [];
  let lastIndex = 0;
  let match;

  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: source.slice(lastIndex, match.index),
      });
    }

    const raw = match[1].trim();

    if (raw.startsWith("!")) {
      // Template comment: intentionally emits no token.
    } else if (raw.startsWith("/")) {
      tokens.push({
        type: "close",
        name: raw.slice(1).trim(),
      });
    } else if (raw.startsWith("#")) {
      const [helper, ...rest] = raw.slice(1).trim().split(/\s+/);
      tokens.push({
        type: "open",
        helper,
        key: rest[0],
      });
    } else if (raw === "else") {
      tokens.push({ type: "else" });
    } else {
      tokens.push({
        type: "variable",
        name: raw.split(/\s+/)[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push({
      type: "text",
      value: source.slice(lastIndex),
    });
  }

  return tokens;
}

export function extractPlaceholders(content) {
  const used = new Set();

  for (const token of tokenizeTemplate(content)) {
    if (
      token.type === "variable" &&
      PLACEHOLDER_NAME_PATTERN.test(token.name)
    ) {
      used.add(token.name);
    } else if (
      token.type === "open" &&
      BLOCK_HELPER_SET.has(token.helper) &&
      token.key !== undefined &&
      PLACEHOLDER_NAME_PATTERN.test(token.key)
    ) {
      used.add(token.key);
    }
  }

  return [...used].sort();
}
