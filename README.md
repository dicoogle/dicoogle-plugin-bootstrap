# dicoogle-plugin-bootstrap

Zero-dependency Node ESM CLI that generates plugin boilerplate for
[dicoogle-next](https://github.com/dicoogle/dicoogle-next).

> **Status:** milestone 2 (validation and naming). The `java` and `web`
> commands validate their input and derive canonical names, but generation is
> not implemented yet. `init` is still a stub.

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
| `init` | Interactive wizard (not implemented in milestone 2) |
| `java` | Validate input and derive Java naming (generation not implemented yet) |
| `web` | Validate input and derive web naming (generation not implemented yet) |
| `list` | Show supported families, web hooks, and template pin status |
| `version` | Show tool, Node, and template-lock versions |

## Validation and naming

`java` and `web` validate before doing anything else. Invalid input exits `2`
and, where meaningful, includes a suggested valid form.

- Plugin ids: lowercase kebab-case, 1–64 characters, not a Java reserved word
  after hyphen removal. `../x` suggests `x`; `a/b` suggests `a-b`; `class`
  suggests `class-plugin`.
- Java families: `storage`, `query-index`, `listener`, `dimse`.
- Listener identity follows D13: `--ingest` → `query` domain, `app.query.<id>`,
  type `query-index`, `IngestListener`; `--retrieve` → `service` domain,
  `app.service.<id>`, type `service`, `RetrieveListener`.
- Storage defaults to `enabled=false` and `scheme=<id>`.
- DIMSE policy targets default to `cfind`; multi-target is supported.
- Name, description, and author are length-checked; plugin versions are
  semver-like; packages, schemes, SPDX license ids, API versions, policy targets,
  and web hooks are validated.
- A package collision warning is produced when ids such as `foo-bar` and
  `foobar` normalize to the same Java package segment. Use `--package` to
  disambiguate.

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
node --test test/validate.test.mjs
node --test test/naming.test.mjs
```

The CLI has no runtime dependencies. The parser, validation, naming, and tests
use only Node built-ins.

## Design

The authoritative design is
[`plugin-bootstrap-design.md`](../plugin-bootstrap-design.md), including the
listener identity addendum. Templates, pinning, and generation arrive in later
milestones.
