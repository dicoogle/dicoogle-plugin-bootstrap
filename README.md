# dicoogle-plugin-bootstrap

Zero-dependency Node ESM CLI that generates plugin boilerplate for
[dicoogle-next](https://github.com/dicoogle/dicoogle-next).

> **Status:** milestone 9 (web templates and multi-hook). The `java` command
> generates Google-Java-Format-clean storage, query-index, and listener Maven
> modules with Spring context tests. The `web` command generates plugin folders
> for all seven UI hooks and multi-hook plugins. DIMSE is intentionally
> descoped. `init` is still a stub.

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
| `java` | Generate a Java module; storage, query-index, and listener are implemented |
| `web` | Generate a web UI plugin folder for one or more hooks |
| `list` | Show supported families, web hooks, and the verified template pin |
| `version` | Show tool, Node, and verified template-lock versions |

## Validation and naming

`java` and `web` validate before doing anything else. Invalid input exits `2`
and, where meaningful, includes a suggested valid form.

- Plugin ids: lowercase kebab-case, 1–64 characters, not a Java reserved word
  after hyphen removal. `../x` suggests `x`; `a/b` suggests `a-b`; `class`
  suggests `class-plugin`.
- Java families: `storage`, `query-index`, `listener`.
- Listener identity follows D13: `--ingest` → `query` domain, `app.query.<id>`,
  type `query-index`, `IngestListener`; `--retrieve` → `service` domain,
  `app.service.<id>`, type `service`, `RetrieveListener`.
- All generated Java families default to `enabled=false` and must opt in. Storage
  also defaults to `scheme=<id>`.
- Plugin ids equal to reserved bundled ids (`lucene`, `query-file-rw`,
  `storage-file-ro`, `storage-file-rw`) are rejected with exit `2`.
  `QueryRouter` keys providers by `metadata().id()`; a duplicate would silently
  overwrite the bundled plugin. The list lives in
  `templates/lock.json` under `reservedPluginIds` and is checked by
  `npm run verify:templates`.
- Name, description, and author are length-checked; plugin versions are
  semver-like; packages, schemes, SPDX license ids, API versions, policy targets,
  and web hooks are validated.
- A package collision warning is produced when ids such as `foo-bar` and
  `foobar` normalize to the same Java package segment. Their class and bean
  names still differ (`FooBarStoragePlugin` / `fooBarStoragePlugin` versus
  `FoobarStoragePlugin` / `foobarStoragePlugin`). Use `--package` to choose a
  distinct Java package if split packages are not acceptable.

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


## Query-index generation

```bash
node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-index --family query-index \
  --ingest --query --move --maintenance --settings \
  --out /tmp/dicoogle-next-query-my-index
```

Query-index capabilities map to `StorageIngestEventListener`, `QueryService`,
`QueryMoveService`, `QueryIndexMaintenance`, and `QueryIndexSettings`.
At least one capability is required; no flags exits `2`. `--settings` alone adds
the `QueryIndexPlugin` marker, `--maintenance` already extends it, and
`--locator` exits `2`. `indexId()` defaults to the plugin id. The config uses
`@Bean(initMethod = "start", destroyMethod = "stop")` with
`@ConditionalOnProperty(..., matchIfMissing = false)`, so the module is opt-in.

Generated bean method names are derived from the generated class name in
lowerCamelCase, so different plugin ids cannot collide in the Spring context.
Generated tests cover the safe stubs, Spring context registration, and
visibility as the list types consumed by the app (`QueryService`,
`QueryMoveService`, `StorageIngestEventListener`, `QueryIndexMaintenance`,
`QueryIndexSettings`).

Safety defaults:

- `query()` and `resolve()` return empty lists with TODOs that name the request
  fields to match. They never return recorded ingest entries unrelated to the
  request.
- `--ingest` still records entries in an in-memory map, exposed only through
  package-private accessors.
- `--maintenance` keeps its own path set and counter; it never feeds query/move.
  `QueryIndexMaintenanceService` applies maintenance to all providers when no
  plugin id is given (`QueryIndexMaintenanceService.java:45-67`).
- Ingest callbacks catch/log `RuntimeException` and never rethrow, because
  `CStoreService` loops without per-listener isolation
  (`CStoreService.java:364`, `:382`, `:233-248`).
- Generated READMEs document routing: empty `app.dimse.dim-providers` and QIDO
  without `provider` mean all providers; unknown names are dropped; results are
  merged/deduplicated; there is no router timeout; provider order is not stable.

`--settings` prints a displacement warning in the README, `--help`, and CLI
stderr: `IndexSettingsController` selects the first `QueryIndexSettings`
provider. Lucene currently wins because `LuceneQueryConfig` has `@Order(0)`
(`LuceneQueryConfig.java:16`), but bean ordering is not a stable contract. If
the generated provider is enabled, only the first provider is exposed and
mutated. Generated tests also assert `start()` and `stop()` run exactly once.

## Listener generation

```bash
node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-audit --family listener --ingest \
  --out /tmp/dicoogle-next-query-my-audit

node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-audit --family listener --retrieve \
  --out /tmp/dicoogle-next-service-my-audit
```

Exactly one of `--ingest` or `--retrieve` is required. Ingest uses the `query`
domain, `app.query.<id>`, type `query-index`, and the `IngestListener` suffix.
Retrieve uses the `service` domain, `app.service.<id>`, type `service`, and the
`RetrieveListener` suffix. Listeners default to `enabled=false`.

Listener callbacks catch/log `RuntimeException` and never rethrow. This matters
because `CStoreService` uses `listeners.forEach` without per-listener isolation
(`CStoreService.java:364`, `:382`); a throwing ingest listener aborts later
listeners and can turn a successful store into a failure
(`CStoreService.java:233-248`). DICOMweb retrieve dispatch uses the same loop
shape (`DicomwebRetrieveService.java:369`, `:382`).

Event scope is intentionally narrow:

- Ingest fires only from DIMSE C-STORE (`CStoreService.java:364`,
  `CStoreService.java:382`). DICOMweb STOW does not invoke it.
- Retrieve fires only from DICOMweb retrieval
  (`DicomwebRetrieveService.java:369`, `DicomwebRetrieveService.java:382`).
  DIMSE C-MOVE does not invoke it.

Bean method names derive from the generated class name in lowerCamelCase, so two
ingest or two retrieve modules with different ids can coexist in one Spring
context.

DIMSE generation is descoped: `DimseAccessPolicy` and
`DimseAssociationEventListener` exist in dicoogle-next but are not generated
because they are absent from classic Dicoogle and access policies can deny
requests. `--family dimse` exits `2`.

## Web generation

```bash
node bin/dicoogle-plugin-bootstrap.mjs web \
  --id study-tools --hooks route,sidebar-menu,settings \
  --name "Study Tools" \
  --out /tmp/study-tools
```

Web hooks: `query-filter`, `result-options`, `result-batch`,
`result-renderer`, `sidebar-menu`, `route`, `settings`. Any subset is valid.
The generated folder contains `plugin.config.json`, `index.ts`, `README.md`,
and `.tsx` components only for the hooks that need them. No `package.json` is
emitted; the host webapp provides React, TypeScript, Vite, and
`@/plugin-system`.

`index.ts` is always JSX-free: icons use `createElement` and components use
`lazy`. `plugin.config.json` uses `apiVersion` `1.0`, `entry` `index.ts`, and a
single `type` (`<hook>` for one hook, `multi` for several). Components use the
exact `QueryFilterProps`/`ResultRendererProps` contracts from
`webapp/src/plugin-system/types.ts`.

Generated web READMEs explain copying the folder into
`webapp/src/plugins/<id>`, restarting Vite, and running `npm run lint`,
`npm run type-check`, and `npm run build`.

## Template lock

`templates/lock.json` is the single pin file. It fixes the dicoogle-next commit
and build versions, the D13 listener identity mapping, reserved bundled plugin
ids, and per-template SHA-256 and placeholder declarations.

Pinned baseline:

- dicoogle-next `cdfbff7f601d663453b9b7b77d6d3dc70af1b822`
- branch `feat/dissertation-frame-baseline`
- Java `21`, Maven `3.9.12`, Spring Boot `4.0.3`, dcm4che `5.34.0`
- parent/SDK `0.0.1-SNAPSHOT`, web `apiVersion` `1.0`

Verify the lock, template files, hashes, placeholders, reserved plugin ids, and
listener identity mapping:

```bash
npm run verify:templates
node scripts/verify-templates.mjs --lock templates/lock.json --templates templates
```

Template bodies cover storage, query-index, and listener POM, README, config,
and properties files plus web config, README, and component templates. Plugin
classes, tests, and web entries are composed from pinned fragments. DIMSE is
descoped.

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
node --test test/query-index-model.test.mjs
node --test test/query-index-plan.test.mjs
node --test test/listener-model.test.mjs
node --test test/listener-plan.test.mjs
node --test test/readme-build.test.mjs
node --test test/web-model.test.mjs
node --test test/web-plan.test.mjs
```

The CLI has no runtime dependencies. The parser, validation, naming, renderer,
lock verification, filesystem safety, and tests use only Node built-ins.

Build the full Java fixture matrix (temp clone, parent/SDK install, all storage,
query-index, listener, and collision cases, Spotless check, tests, no-rewrite
hash check, full reactor, standalone builds):

```bash
node scripts/build-fixtures.mjs --repo /path/to/dicoogle-next --keep

# Faster targeted collision check:
node scripts/build-fixtures.mjs --repo /path/to/dicoogle-next \
  --only collision --skip-standalone
```

`--only <case[,case]>` runs selected cases; `--only collision` expands to the
ten collision modules. `--skip-standalone` and `--skip-full-reactor` speed up
local iteration.

## Design

The authoritative design is [`docs/design.md`](docs/design.md), including
Addendum A for listener identity. Storage, query-index, and listener generation,
the renderer, lock verification, reserved bundled-id checks, dry-run/safe-write
tooling, the Java compile fixture, and web templates are implemented; DIMSE and
the interactive wizard remain descoped/out of scope.
