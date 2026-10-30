# dicoogle-plugin-bootstrap

Zero-dependency Node ESM CLI that generates plugin boilerplate for
[dicoogle-next](https://github.com/dicoogle/dicoogle-next).

> **Status:** milestone 1 (repository skeleton and CLI contract). The `java`,
> `web`, and `init` commands are recognized by the parser but generation is not
> implemented yet.

## Requirements

- Node.js 20 or newer
- Java 21 and Maven 3.9.12 only when building generated Java modules

## Usage

```bash
node bin/dicoogle-plugin-bootstrap.mjs --help
node bin/dicoogle-plugin-bootstrap.mjs version
node bin/dicoogle-plugin-bootstrap.mjs list
```

After `npm link`, the same commands are available as
`dicoogle-plugin-bootstrap`.

## Commands

| Command | Description |
|---|---|
| `init` | Interactive wizard (not implemented in milestone 1) |
| `java` | Generate a Java Maven module (not implemented in milestone 1) |
| `web` | Generate a web UI plugin folder (not implemented in milestone 1) |
| `list` | Show supported families, web hooks, and template pin status |
| `version` | Show tool, Node, and template-lock versions |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `2` | Usage or validation error: unknown command/flag, invalid value, missing argument |
| `3` | Target is non-empty without `--force` |
| `4` | Plugin id collision in the requested namespace |
| `5` | Template lock missing/invalid or template error |
| `6` | I/O or internal error |
| `7` | Unsupported runtime (Node < 20) |
| `130` | Interrupted by `SIGINT` |

## Development

```bash
npm test
node --test test/cli.test.mjs
```

The CLI has no runtime dependencies. The parser, command dispatch, and tests use
only Node built-ins.

## Design

The authoritative design is
[`plugin-bootstrap-design.md`](../plugin-bootstrap-design.md). Templates,
pinning, and generation arrive in later milestones.
