export const EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE: 2,
  TARGET_NOT_EMPTY: 3,
  DUPLICATE_ID: 4,
  TEMPLATE: 5,
  INTERNAL: 6,
  UNSUPPORTED_RUNTIME: 7,
  SIGINT: 130,
});

export class CliError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "CliError";
    this.exitCode = options.exitCode ?? EXIT_CODES.INTERNAL;
    this.showHelp = options.showHelp ?? false;
  }
}

export class UsageError extends CliError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      exitCode: EXIT_CODES.USAGE,
      showHelp: options.showHelp ?? true,
    });
    this.name = "UsageError";
  }
}

export function normalizeError(error) {
  if (error instanceof CliError) {
    return error;
  }

  const message =
    error instanceof Error && error.message ? error.message : String(error);
  return new CliError(message, {
    exitCode: EXIT_CODES.INTERNAL,
    cause: error,
  });
}

export function formatError(error) {
  const normalized = normalizeError(error);
  return `error: ${normalized.message}`;
}
