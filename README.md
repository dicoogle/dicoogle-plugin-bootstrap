# dicoogle-plugin-bootstrap

Zero-dependency Node CLI that generates dicoogle-next plugin boilerplate.

It **creates files only**. It never edits `backend/pom.xml`,
`dicoogle-next/pom.xml`, `application.yml`, `webapp/src/plugins`, or any other
existing project file. Wiring is manual.

Requires Node.js 20 or newer. Java 21 and Maven 3.9.12 are needed only to build
generated Java modules.

## Install and run

```bash
git clone <this repo>
cd dicoogle-plugin-bootstrap
node bin/dicoogle-plugin-bootstrap.mjs --help
```

Optional:

```bash
npm link
dicoogle-plugin-bootstrap --help
```

## Families and flags

| Family / hook | Flags | Example |
|---|---|---|
| storage | `--family storage` and one or more of `--readable --writable --listable --locator` | `node bin/dicoogle-plugin-bootstrap.mjs java --id my-store --family storage --readable --writable --listable --locator --out /tmp/my-store` |
| query-index | `--family query-index` and one or more of `--ingest --query --move --maintenance --settings` | `node bin/dicoogle-plugin-bootstrap.mjs java --id my-index --family query-index --ingest --query --move --maintenance --settings --out /tmp/my-index` |
| listener ingest | `--family listener --ingest` | `node bin/dicoogle-plugin-bootstrap.mjs java --id audit --family listener --ingest --out /tmp/audit` |
| listener retrieve | `--family listener --retrieve` | `node bin/dicoogle-plugin-bootstrap.mjs java --id metrics --family listener --retrieve --out /tmp/metrics` |
| web `query-filter` | `--hooks query-filter` | `node bin/dicoogle-plugin-bootstrap.mjs web --id date-range --hooks query-filter --out /tmp/date-range` |
| web `result-options` | `--hooks result-options` | `node bin/dicoogle-plugin-bootstrap.mjs web --id download-study --hooks result-options --out /tmp/download-study` |
| web `result-batch` | `--hooks result-batch` | `node bin/dicoogle-plugin-bootstrap.mjs web --id download-batch --hooks result-batch --out /tmp/download-batch` |
| web `result-renderer` | `--hooks result-renderer` | `node bin/dicoogle-plugin-bootstrap.mjs web --id gallery --hooks result-renderer --out /tmp/gallery` |
| web `sidebar-menu` | `--hooks sidebar-menu` | `node bin/dicoogle-plugin-bootstrap.mjs web --id shortcuts --hooks sidebar-menu --out /tmp/shortcuts` |
| web `route` | `--hooks route` | `node bin/dicoogle-plugin-bootstrap.mjs web --id reports --hooks route --out /tmp/reports` |
| web `settings` | `--hooks settings` | `node bin/dicoogle-plugin-bootstrap.mjs web --id my-settings --hooks settings --out /tmp/my-settings` |
| web multi-hook | comma-separated `--hooks` | `node bin/dicoogle-plugin-bootstrap.mjs web --id study-tools --hooks route,sidebar-menu,settings --out /tmp/study-tools` |

Other supported flags:

`--id`, `--out`, `--name`, `--description`, `--author`, `--plugin-version`,
`--license`, `--type`, `--force`, `--dry-run`, `--package`, `--scheme`,
`--api-version`, `--help`.

`sidebar-menu` without `route` prints a warning: the menu points to
`/plugins/<id>` and needs a matching route.

## Build a generated plugin

Java module:

```bash
cd /tmp/my-store
mvn -B -ntp spotless:check test
```

Standalone builds need the parent and SDK installed once from the pinned
dicoogle-next checkout:

```bash
cd backend
./mvnw -B -ntp -N install
./mvnw -B -ntp -pl dicoogle-next-sdk -am install
```

Web plugin:

```bash
cp -R /tmp/date-range /path/to/dicoogle-next/webapp/src/plugins/date-range
cd /path/to/dicoogle-next/webapp
npm ci
npm run lint
npm run type-check
npm run build
```

Generated web folders have no `package.json`; the host webapp provides React,
TypeScript, Vite, and `@/plugin-system`. Restart Vite after adding a new plugin
folder.

## Manual wiring

Java:

1. Copy the module to `backend/plugins/<artifactId>`.
2. Add `<module>plugins/<artifactId></module>` to `backend/pom.xml`.
3. Add the module dependency to `backend/dicoogle-next/pom.xml`.
4. Add the YAML from the generated `README.md` to `application.yml`.
5. Rebuild the app.

Web:

1. Copy the folder to `webapp/src/plugins/<id>`.
2. Restart Vite.
3. Run `npm run lint`, `npm run type-check`, and `npm run build`.

The tool never performs these steps.

## How it was verified

The Java fixture matrix lives in `scripts/build-fixtures.mjs`; it builds and
tests generated storage, query-index, listener, collision, full-reactor, and
standalone modules in temp clones of dicoogle-next. Web hooks were generated
into a temp `webapp/src/plugins` and checked with `npm ci`, lint, type-check,
build, and the Vite virtual plugin module. The pinned reference commit is
`cdfbff7f601d663453b9b7b77d6d3dc70af1b822`.

See [`docs/design.md`](docs/design.md) for the full design.
