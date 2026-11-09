# dicoogle-plugin-bootstrap

`dicoogle-plugin-bootstrap` generates starter plugins for dicoogle-next. It can
generate a standalone plugin module, a plugin module inside an existing
dicoogle-next checkout, or a new multi-module Maven project with `init` plus
`java --project`. It never edits the dicoogle-next checkout, and it does not
change application YAML or wire plugins into the app for you. Node.js 20 or newer
is required. Java 21 and Maven 3.9.12 are needed only when building generated
Java plugins.

Run it directly; no `npm install` is needed:

```bash
node bin/dicoogle-plugin-bootstrap.mjs --help
node bin/dicoogle-plugin-bootstrap.mjs version
```

## How it works

```text
Project: init -> java --project -> mvn package -> run prebuilt app + plugin jars
In-repo: generate -> add module/dependency by hand -> rebuild app
Web:     generate -> copy to webapp/src/plugins -> Vite build -> run web app
```

1. The tool writes a self-contained folder under `--out`.
2. Java output is a normal Maven module. It depends on the dicoogle-next parent
   POM and SDK, so install those once from the dicoogle-next checkout. They are
   not published remotely.
3. dicoogle-next has no drop-in Java plugin folder. In the project flow, `init`
   creates a `<packaging>pom</packaging>` root and `java --project` adds each
   module to its `<modules>` block. In the in-repo flow, add the module to
   `backend/pom.xml` and as a dependency in `backend/dicoogle-next/pom.xml`
   yourself; the plugin jar then ends up inside the app's jar.
4. At startup the Spring application scans `org.dicoogle`. The generated
   `Config` class creates the plugin bean only when its `enabled` property is
   `true`. Generated Java plugins are off by default. A plugin package outside
   `org.dicoogle` is not discovered; the tool prints a warning for that case.
5. Web output has no build of its own. Copy the folder under
   `webapp/src/plugins/`; the host Vite build discovers `plugin.config.json` and
   compiles the entry into the web app. Restart Vite when adding a new folder.

## Which plugin type do I need?

| Type | Use it when | Important limits |
|---|---|---|
| `storage` | You need to read, write, list, or locate DICOM objects in a storage backend. | It stores bytes; it does not by itself make objects searchable. |
| `query-index` | You maintain an index and answer C-FIND/QIDO queries, C-MOVE resolution, ingest events, maintenance, or index settings. | The generated `query()` and `resolve()` return empty until you implement request matching. The built-in C-FIND/C-MOVE/QIDO code asks providers and performs the transfer. |
| Listener `--ingest` | You want to observe successful or failed DIMSE C-STORE events. | It fires only for DIMSE C-STORE. DICOMweb STOW does not invoke it. |
| Listener `--retrieve` | You want to observe DICOMweb retrieval events. | It fires only for DICOMweb retrieval, not DIMSE C-MOVE. |
| Web `query-filter` | You add a control that contributes query text. | Runs in the browser only. |
| Web `result-options` | You add an action for one selected study. | Runs in the browser only. |
| Web `result-batch` | You add an action for several selected studies. | Runs in the browser only. |
| Web `result-renderer` | You replace or extend how search results are displayed. | Runs in the browser only. |
| Web `sidebar-menu` | You add a navigation item. | It points to `/plugins/<id>`; add `route` too or provide that route yourself. |
| Web `route` | You add a page to the web app. | Runs in the browser only. |
| Web `settings` | You add a settings tab. | Runs in the browser only. |

Multiple web hooks can be generated together.

## Walkthrough 0: multi-module project with the prebuilt app

Create the project root once:

```bash
node bin/dicoogle-plugin-bootstrap.mjs init \
  --id my-plugins \
  --name "My Dicoogle Plugins" \
  --group-id com.example \
  --version 0.0.1-SNAPSHOT \
  --out /path/to/my-plugins
```

This writes `pom.xml`, `.gitignore`, and `README.md`. The root POM uses
`org.dicoogle:dicoogle-next-backend-parent:0.0.1-SNAPSHOT` as its parent with an
empty `<relativePath/>`, is `<packaging>pom</packaging>`, and starts with an empty
`<modules>` block.

The dicoogle parent enforces Java 21 and Maven 3.9.12 or newer, so those versions
are required. The generated project has no Maven wrapper; use `mvn` from `PATH`.

Add a plugin module:

```bash
node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-store \
  --family storage \
  --readable \
  --project /path/to/my-plugins
```

With `--project`, the module is written to
`<project>/plugins/dicoogle-next-storage-my-store` unless `--out` overrides it,
and `plugins/dicoogle-next-storage-my-store` is appended to the root `<modules>`
block. The generated module inherits directly from the dicoogle parent with
`<relativePath/>`. Use `--dry-run` to inspect the output without writing files or
editing the root POM.

Build the project:

```bash
cd /path/to/my-plugins
mvn -B -ntp package
```

Run the prebuilt dicoogle-next fat jar with the plugin jars on the loader path.
This exact method was verified against the locally installed
`0.0.1-SNAPSHOT` artifact: the generated storage plugin appeared in
`/api/system/plugins` and its scheme was reported in the startup log.

```bash
java \
  -Dloader.path=/path/to/my-plugins/plugins/my-store/target/dicoogle-next-storage-my-store-0.0.1-SNAPSHOT.jar \
  -cp "$HOME/.m2/repository/org/dicoogle/dicoogle-next/0.0.1-SNAPSHOT/dicoogle-next-0.0.1-SNAPSHOT.jar" \
  org.springframework.boot.loader.launch.PropertiesLauncher \
  --app.storage.my-store.enabled=true
```

Use the property prefix that matches the module (`app.storage.<id>`,
`app.query.<id>`, or `app.service.<id>`). Do not use `java -jar` for this: the
external plugin jars are not inside the application fat jar.

## Walkthrough 1: Java storage plugin

### 1. Install the parent POM and SDK

```bash
cd /path/to/dicoogle-next/backend
./mvnw -B -ntp -N install
./mvnw -B -ntp -pl dicoogle-next-sdk -am install
```

These artifacts are local-only, so this step is required for standalone builds
and for modules outside the dicoogle-next reactor.

### 2. Generate the module

Check the plan first, then write it:

```bash
node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-store --family storage \
  --readable --writable --listable --locator \
  --out /path/to/dicoogle-next/backend/plugins/dicoogle-next-storage-my-store \
  --dry-run

node bin/dicoogle-plugin-bootstrap.mjs java \
  --id my-store --family storage \
  --readable --writable --listable --locator \
  --out /path/to/dicoogle-next/backend/plugins/dicoogle-next-storage-my-store
```

Generated tree:

```text
dicoogle-next-storage-my-store/
  pom.xml
  README.md
  src/main/java/org/dicoogle/storage/mystore/MyStoreStoragePlugin.java
  src/main/java/org/dicoogle/storage/mystore/MyStoreStoragePluginConfig.java
  src/main/java/org/dicoogle/storage/mystore/MyStoreStoragePluginProperties.java
  src/test/java/org/dicoogle/storage/mystore/MyStoreStoragePluginTest.java
```

| File | Purpose | Edit |
|---|---|---|
| `pom.xml` | Maven parent, SDK, Spring, and test dependencies. | Usually no. |
| `MyStoreStoragePlugin.java` | Plugin metadata and selected storage methods. | Replace the file-backed stub logic with your backend. Keep the interface methods. |
| `MyStoreStoragePluginConfig.java` | Spring `@Configuration`; creates the bean when enabled. | Usually no. |
| `MyStoreStoragePluginProperties.java` | `enabled`, `rootDir`, `scheme`. | Add your own settings here. |
| `MyStoreStoragePluginTest.java` | Direct tests plus Spring context registration tests. | Extend with your behavior. |
| `README.md` | Generated YAML, build commands, and wiring notes. | Keep it with the plugin. |

### 3. Build and test the module

```bash
cd /path/to/dicoogle-next/backend/plugins/dicoogle-next-storage-my-store
mvn -B -ntp spotless:check test
```

`spotless:check` verifies Google Java Format; `test` runs the generated Jupiter
tests.

### 4. Wire it into the app

Add the module in `backend/pom.xml`:

```xml
<module>plugins/dicoogle-next-storage-my-store</module>
```

Add the dependency in `backend/dicoogle-next/pom.xml`:

```xml
<dependency>
  <groupId>org.dicoogle</groupId>
  <artifactId>dicoogle-next-storage-my-store</artifactId>
  <version>${project.version}</version>
</dependency>
```

Add this to `application.yml` and set `enabled: true`:

```yaml
app:
  storage:
    my-store:
      enabled: true
      root-dir: ./data/my-store
      scheme: my-store
```

Rebuild:

```bash
cd /path/to/dicoogle-next/backend
./mvnw -B -ntp -pl dicoogle-next -am -DskipTests package
```

Start the app the same way you normally run dicoogle-next.

### 5. Confirm it loaded

Call the authenticated `GET /api/system/plugins` and look for your plugin id
(`my-store`). The servlet context path is `/api`.

## Walkthrough 2: Web route plus sidebar item

Generate into a staging folder:

```bash
node bin/dicoogle-plugin-bootstrap.mjs web \
  --id reports --hooks route,sidebar-menu \
  --name "Reports" --description "Reports plugin" \
  --out /path/to/generated-web/reports
```

Copy it into the web app:

```bash
cp -R /path/to/generated-web/reports \
  /path/to/dicoogle-next/webapp/src/plugins/reports
```

Restart the Vite dev server after copying a new plugin folder:

```bash
cd /path/to/dicoogle-next/webapp
npm ci
npm run dev
```

For checks before committing:

```bash
npm run lint
npm run type-check
npm run build
```

The sidebar item appears in the top navigation because `MainLayout` renders
plugin sidebar extensions. The route `/plugins/reports` is registered by
`App.tsx`; with the current base path it is reached under
`/experimental/plugins/reports`.

Edit `index.ts` for extension metadata, `ReportsPage.tsx` for the page, and
`plugin.config.json` for plugin metadata.

## Understanding the generated code

### Java files

| Family | File | Purpose | Developer edit |
|---|---|---|---|
| storage | `<Class>.java` | `ReadableStoragePlugin`, `WritableStoragePlugin`, `ListableStoragePlugin`, and/or `DicomInstanceLocator`. | Replace the temp-directory stub. |
| query-index | `<Class>.java` | Optional ingest, query, move, maintenance, settings. | Implement matching and real index behavior. |
| listener ingest | `<Class>.java` | `StorageIngestEventListener`. | Replace recorded-event helper with real logic. |
| listener retrieve | `<Class>.java` | `StorageRetrieveEventListener`. | Replace recorded-event helper with real logic. |

### Web hooks

| Hook | Generated files | Purpose | Developer edit |
|---|---|---|---|
| `query-filter` | `index.ts`, `<Class>Filter.tsx` | Filter control plus `applyFilter` slot. | Add matching query logic and UI. |
| `result-options` | `index.ts` | One-study action. | Replace the log/toast action. |
| `result-batch` | `index.ts` | Multi-study action. | Replace the log/toast action. |
| `result-renderer` | `index.ts`, `<Class>Renderer.tsx` | Custom results view. | Build the real view. |
| `sidebar-menu` | `index.ts` | Top-navigation item at `/plugins/<id>`. | Add or pair with a route. |
| `route` | `index.ts`, `<Class>Page.tsx` | Page at `/plugins/<id>`. | Build the page. |
| `settings` | `index.ts`, `<Class>Settings.tsx` | Settings tab. | Build the controls. |

Stub behavior:

- Query-index `query()` and `resolve()` intentionally return empty lists until
  request matching is implemented. They do not expose recorded ingest entries.
- Ingest/retrieve callbacks catch and log `RuntimeException`; they never rethrow.
  This keeps one plugin from breaking the shared dispatch loop.
- Plugin ids must be unique. These bundled ids are reserved and rejected:
  `lucene`, `query-file-rw`, `storage-file-ro`, `storage-file-rw`.

## Build and test explained

`mvn -B -ntp spotless:check test` checks formatting and runs the Jupiter tests.

There are two Java build modes:

- In-repo mode: the module sits under `backend/plugins/...`, so Maven finds the
  parent at `../../pom.xml`.
- Standalone mode: the module is outside the checkout; Maven resolves the parent
  and SDK from `~/.m2`, so install them first.

In-repo:

```bash
cd /path/to/dicoogle-next/backend
./mvnw -B -ntp -pl plugins/dicoogle-next-storage-my-store spotless:check test
```

Standalone:

```bash
cd /path/to/standalone/dicoogle-next-storage-standalone-store
mvn -B -ntp spotless:check test
```

Common fixes:

- Parent POM not found: install the parent with `./mvnw -B -ntp -N install`, or
  generate under `backend/plugins`.
- SDK not installed: run
  `./mvnw -B -ntp -pl dicoogle-next-sdk -am install`.
- Spotless formatting failure: run `mvn -B -ntp spotless:apply`, review the
  change, then rerun the check.
- Duplicate bean name: two modules generated the same class/bean name. Use
  distinct `--id` values and regenerate.

## Quick reference

`init` flags:

| Flag | Default | Applies to |
|---|---|---|
| `--id <kebab>` | required | `init` (project id / artifactId) |
| `--name <text>` | title-cased id | `init` |
| `--group-id <id>` | `com.example` | `init` |
| `--version <v>` | `0.0.1-SNAPSHOT` | `init` |
| `--out <path>` | project id | `init` |
| `--force` | off | `init` |
| `--dry-run` | off | `init` |

Common flags:

| Flag | Default | Applies to |
|---|---|---|
| `--id <kebab>` | required | all generation |
| `--name <text>` | title-cased id | all generation |
| `--description <text>` | `TODO: describe <name>` | all generation |
| `--author <text>` | `Unknown` | web only in practice (used in `plugin.config.json`; Java output ignores it) |
| `--plugin-version <v>` | `0.1.0` | all generation |
| `--out <path>` | family-specific | all generation |
| `--force` | off | all generation |
| `--dry-run` | off | all generation |
| `--license <SPDX\|none>` | `none` | Java (ignored by web) |
| `--type <token>` | derived | all generation; overrides the metadata/descriptor type token |
| `--help`, `-h` | | global |

Java-only flags:

| Flag | Default | Applies to |
|---|---|---|
| `--family storage\|query-index\|listener` | required | Java |
| `--readable`, `--writable`, `--listable`, `--locator` | readable if no concrete storage capability | storage only |
| `--ingest`, `--query`, `--move`, `--maintenance`, `--settings` | at least one required | query-index |
| `--ingest`, `--retrieve` | exactly one required | listener |
| `--package <pkg>` | `org.dicoogle.<domain>.<id>` | Java; packages outside `org.dicoogle` produce a discovery warning |
| `--scheme <scheme>` | id | storage; ignored by other Java families |
| `--project <dir>` | none | Java; writes to `<project>/plugins/<artifactId>` and adds the module to the project root POM |

Web-only flags:

| Flag | Default | Applies to |
|---|---|---|
| `--hooks <a,b>` | required | web |
| `--api-version <v>` | `1.0` | web; only `1` or `1.0` |

Flags for another family are rejected with exit `2`, for example
`--writable` on query-index or `--hooks` on Java. `--type <token>` overrides
the metadata type for Java and the `type` field in the web descriptor.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Success |
| `2` | Usage or validation error |
| `3` | Target is not empty and `--force` was not used |

Any other non-zero code is an internal error.

## Maintaining

The Java fixture matrix is `scripts/build-fixtures.mjs`. It clones
dicoogle-next into a temporary directory at the pinned commit, generates
modules, checks Spotless and tests, runs the full reactor and standalone
builds, generates a multi-module project, and keeps the clone for inspection
when asked. Run it with:

```bash
node scripts/build-fixtures.mjs --repo /path/to/dicoogle-next
```

The pin lives in `templates/lock.json`: commit, branch, Java/Maven/Spring
Boot/dcm4che versions, parent/SDK versions, web API version, and reserved plugin
ids. Update those fields and the templates by hand when moving to a new
dicoogle-next commit.

Run the tool tests with:

```bash
npm test
```

Known limits:

- Web placement is verified by the Vite build only, not in a browser.
- Java load from external jars is verified for one generated storage plugin
  using `PropertiesLauncher` and `-Dloader.path`, not for every family or in CI.
- There is no template drift check.
- There is no duplicate-id scan beyond the reserved list.
