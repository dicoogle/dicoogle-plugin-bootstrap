import { UsageError } from "./errors.mjs";

const GLOBAL_BOOLEAN = ["--help", "-h", "--no-color", "--verbose"];
const GLOBAL_VALUE = [];

const COMMON_BOOLEAN = ["--force", "--dry-run"];
const COMMON_VALUE = [
  "--id",
  "--name",
  "--description",
  "--author",
  "--plugin-version",
  "--out",
  "--repo",
  "--license",
  "--type",
];

const JAVA_BOOLEAN = [
  "--readable",
  "--writable",
  "--listable",
  "--locator",
  "--ingest",
  "--query",
  "--move",
  "--maintenance",
  "--settings",
  "--retrieve",
  "--access-policy",
  "--association-listener",
];
const JAVA_VALUE = ["--family", "--policy-target", "--package", "--scheme"];

const WEB_BOOLEAN = [];
const WEB_VALUE = ["--hooks", "--api-version"];

function makeSpec(extraBoolean = [], extraValue = []) {
  return {
    boolean: new Set([...GLOBAL_BOOLEAN, ...COMMON_BOOLEAN, ...extraBoolean]),
    value: new Set([...GLOBAL_VALUE, ...COMMON_VALUE, ...extraValue]),
  };
}

const COMMAND_SPECS = Object.freeze({
  init: makeSpec([...JAVA_BOOLEAN, ...WEB_BOOLEAN], [
    ...JAVA_VALUE,
    ...WEB_VALUE,
  ]),
  java: makeSpec(JAVA_BOOLEAN, JAVA_VALUE),
  web: makeSpec(WEB_BOOLEAN, WEB_VALUE),
  list: makeSpec(),
  version: makeSpec(),
});

export const SUPPORTED_COMMANDS = Object.freeze(Object.keys(COMMAND_SPECS));

function flagKey(name) {
  return name
    .replace(/^--?/, "")
    .replace(/-([a-z0-9])/g, (_, character) => character.toUpperCase());
}

function parseFlags(tokens, spec, command) {
  const flags = Object.create(null);
  const positionals = [];
  let endOfFlags = false;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (endOfFlags) {
      positionals.push(token);
      continue;
    }

    if (token === "--") {
      endOfFlags = true;
      continue;
    }

    if (token === "-" || !token.startsWith("-")) {
      positionals.push(token);
      continue;
    }

    if (token === "-h" || token === "--help") {
      flags.help = true;
      continue;
    }

    let name = token;
    let value;
    let hasInlineValue = false;
    const equalsIndex = token.indexOf("=");

    if (equalsIndex !== -1) {
      name = token.slice(0, equalsIndex);
      value = token.slice(equalsIndex + 1);
      hasInlineValue = true;
    }

    const where = command ? ` for command "${command}"` : "";

    if (!spec.boolean.has(name) && !spec.value.has(name)) {
      throw new UsageError(`unknown flag "${name}"${where}`);
    }

    if (spec.boolean.has(name)) {
      if (hasInlineValue) {
        throw new UsageError(`flag "${name}" does not take a value${where}`);
      }
      flags[flagKey(name)] = true;
      continue;
    }

    if (!hasInlineValue) {
      const next = tokens[index + 1];
      if (next === undefined || (next.startsWith("-") && next !== "-")) {
        throw new UsageError(`flag "${name}" requires a value${where}`);
      }
      value = next;
      index += 1;
    }

    flags[flagKey(name)] = value;
  }

  return { flags, positionals };
}

export function parseArgv(argv = []) {
  const tokens = argv.map(String);

  if (tokens.length === 0) {
    return { command: null, flags: Object.create(null), help: false };
  }

  const first = tokens[0];

  if (first === "--help" || first === "-h") {
    return { command: null, flags: { help: true }, help: true };
  }

  if (first.startsWith("-")) {
    const globalSpec = makeSpec();
    const { flags, positionals } = parseFlags(tokens, globalSpec, null);

    if (positionals.length > 0) {
      throw new UsageError(`expected a command before "${positionals[0]}"`);
    }

    return {
      command: null,
      flags,
      help: Boolean(flags.help),
    };
  }

  const command = first;

  if (!Object.hasOwn(COMMAND_SPECS, command)) {
    throw new UsageError(`unknown command "${command}"`);
  }

  const { flags, positionals } = parseFlags(
    tokens.slice(1),
    COMMAND_SPECS[command],
    command,
  );

  if (positionals.length > 0) {
    throw new UsageError(
      `unexpected argument "${positionals[0]}" for command "${command}"`,
    );
  }

  return {
    command,
    flags,
    help: Boolean(flags.help),
  };
}

export function validateArgv(parsed) {
  const { command, flags } = parsed;

  if (
    command === "java" &&
    flags.family === "query-index" &&
    flags.locator === true
  ) {
    throw new UsageError(
      "--locator is not supported for the query-index family: only storage " +
        "plugins feed List<DicomInstanceLocator> on dicoogle-next HEAD.",
    );
  }

  return parsed;
}
