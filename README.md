# dicoogle-plugin-bootstrap

Zero-dependency Node ESM CLI that generates plugin boilerplate for
[dicoogle-next](https://github.com/dicoogle/dicoogle-next).

> **Status:** milestone 5 (Java storage templates and compile fixture). The
> `java --family storage` command generates a working, Google-Java-Format-clean
> Maven module with Spring context tests, safe writes, and dry-run support.
> Other Java families, `web`, and `init` are still stubs.

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
| `init` | Interactive wizard (not implemented) |
| `java` | Generate a Java module; storage is implemented, other families are stubs |
| `web` | Validate input and derive web naming (generation not implemented yet) |
| `list` | Show supported families, web hooks, and the verified template pin |
| `version` | Show tool, Node, and verified template-lock versions |

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

## Storage generation

```bash
node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-store --family storage \
  --readable --writable --listable --locator \
  --out /tmp/dicoogle-next-storage-my-store
```

This writes six files: `pom.xml`, `README.md`, the plugin class, config,
properties, and a Jupiter test. The generated class implements only the selected
interfaces; `--listable` implies readable and `--locator` adds only
`DicomInstanceLocator`. If no concrete storage interface is selected, readable is
added so the class still implements a concrete `StoragePlugin`.

The generated test suite includes direct-instantiation capability tests and
`ApplicationContextRunner` checks: `enabled=true` must register the plugin bean
with the expected id/type, and the default `enabled=false` must register nothing.
The POM output XML-escapes the name and description.

`--dry-run` validates, renders and composes the plan in memory, runs the
post-render validators, and prints only the file tree; it writes nothing. A
non-empty target exits `3` unless `--force` is used. Writes use `wx` unless
forced, refuse the filesystem root and regular-file targets, and refuse symlink
components under `--out`. Parent POM conflicts (`../../pom.xml` with the wrong
GAV) exit `2`.

## Template lock

`templates/lock.json` is the single pin file. It fixes the dicoogle-next commit
and build versions, the D13 listener identity mapping, and per-template SHA-256
and placeholder declarations.

Pinned baseline:

- dicoogle-next `cdfbff7f601d663453b9b7b77d6d3dc70af1b822`
- branch `feat/dissertation-frame-baseline`
- Java `21`, Maven `3.9.12`, Spring Boot `4.0.3`, dcm4che `5.34.0`
- parent/SDK `0.0.1-SNAPSHOT`, web `apiVersion` `1.0`

Verify the lock, template files, hashes, placeholders, and listener identity
mapping:

```bash
npm run verify:templates
node scripts/verify-templates.mjs --lock templates/lock.json --templates templates
```

Template bodies currently cover storage POM, README, config, and properties
files. The plugin class and test are composed from pinned fragments. Larger
template sets arrive in later milestones.

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
npm run verify:templates
node --test test/cli.test.mjs
node --test test/validate.test.mjs
node --test test/naming.test.mjs
node --test test/lock.test.mjs
node --test test/render.test.mjs
node --test test/model.test.mjs
node --test test/plan.test.mjs
node --test test/fs.test.mjs
node --test test/parent.test.mjs
```

The CLI has no runtime dependencies. The parser, validation, naming, renderer,
lock verification, filesystem safety, and tests use only Node built-ins.

Build the full Java fixture matrix (temp clone, parent/SDK install, all storage
cases, Spotless check, tests, no-rewrite hash check, full reactor, standalone):

```bash
node scripts/build-fixtures.mjs --repo /path/to/dicoogle-next --keep
```

## Design

The authoritative design is [`docs/design.md`](docs/design.md), including
Addendum A for listener identity. Storage generation, the renderer, lock
verification, dry-run/safe-write tooling, and the Java compile fixture are
implemented; other Java families, web generation, and the interactive wizard
remain.
