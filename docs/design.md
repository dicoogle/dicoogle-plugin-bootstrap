# Dicoogle Next Plugin Bootstrap CLI — Design

- **Status:** DESIGN ONLY. No tool code, no generated code, no changes to `dicoogle-next`.
- **Output of this milestone:** this document only.
- **Reference project (read-only):** `/home/jotalma13/Documents/Bolsa/dicoogle-next`
- **Tool repository (to be created later):** `/home/jotalma13/Documents/Bolsa/dicoogle-plugin-bootstrap`
- **Investigation input:** `/home/jotalma13/Documents/Bolsa/plugin-bootstrap-investigation.md`

## 0. Baseline and verification method

The facts below were re-checked against the working tree, not copied from the report.

| Item | Verified value | Evidence |
|---|---|---|
| Branch | `feat/dissertation-frame-baseline` | `git branch --show-current` |
| HEAD | `cdfbff7f601d663453b9b7b77d6d3dc70af1b822` | `git rev-parse HEAD` |
| `dev` ancestor | `5ca0b5c` | `git merge-base --is-ancestor dev HEAD` |
| Backend module list | app, SDK, core, 3 protocol modules, 4 plugin modules | `backend/pom.xml:21-32` |
| Spring Boot parent | `4.0.3` | `backend/pom.xml:6-11` |
| Java / minimum Maven | `21` / `3.9.12` | `backend/pom.xml:35-36`, `backend/pom.xml:65-70` |
| dcm4che | `5.34.0` | `backend/pom.xml:38`, `backend/dicoogle-next-sdk/pom.xml:18-22` |
| Spotless | `2.44.3`, google-java-format `1.24.0`, `GOOGLE`, `apply` at `validate` | `backend/pom.xml:39-40`, `backend/pom.xml:76-112` |
| Web stack | Vite 8, TypeScript 6, React 18, Node 20 in CI | `webapp/package.json:5-53`, `.github/workflows/ci.yml:27-46` |
| Local runtime observed | Java 21.0.9, Maven 3.9.12, Node 22.22.0, npm 10.9.4 | `java -version`, `mvn -v`, `node -v`, `npm -v` |
| SDK distribution | Local `mvn install` only as verified; no `distributionManagement` | grep over `backend/**/pom.xml`; `~/.m2/repository/org/dicoogle/...` |
| Java license headers | none in `backend/**/*.java`; repo license is GPLv3 | `grep -rl "Copyright (C)" backend --include=*.java` → `0`; `license.md:1-2` |
| Web plugin source directory | empty except `.gitkeep` | `webapp/src/plugins/.gitkeep` |

### 0.1 Report facts that changed or need correction

These are important because they change the CLI contract.

1. **JUnit version wording is imprecise.** The report says “JUnit 5”. The source uses the Jupiter API (`org.junit.jupiter`), but Spring Boot 4.0.3 resolves `junit-jupiter` to `6.0.3` (observed in `backend/plugins/*/target/surefire-reports/*.xml`). The generated tests must use the Jupiter API and must not pin a JUnit version; the parent BOM manages it. Treat “JUnit 5” as “Jupiter API”.
2. **`StorageRetrieveEventListener` is consumed only by DICOMweb retrieval.** It is injected into `DicomwebRetrieveService` and fired at `DicomwebRetrieveService.java:369` and `:382`. It is not fired by DIMSE C-MOVE. The report’s “C-MOVE or WADO-RS” wording is broader than the code.
3. **`StorageIngestEventListener` is consumed only by DIMSE C-STORE.** It is injected into `CStoreService` and fired at `CStoreService.java:364` and `:382`. No DICOMweb STOW consumer was found.
4. **`DimseAssociationEventListener` is consumed only by the C-STORE server.** It is injected into `DimseCStoreServer` (`DimseCStoreConfig.java:90`) and fired from `DimseCStoreServer.java:291`, `:305`, `:354`, `:358`. It is not a generic all-DIMSE association hook.
5. **`ServicePlugin` and `MlProviderPlugin` are still not directly consumed.** However `StorageRetrieveEventListener extends ServicePlugin`, so the *only* live service extension is the retrieve listener. Excluding the `ServicePlugin` and `MlProviderPlugin` families remains correct.
6. **A pure query-index `QueryIndexStorageLocator` is not independently consumed on HEAD.** `PluginRuntimeConfig` builds the only `List<DicomInstanceLocator>` bean by filtering `ActiveStoragePlugins.plugins()` (`PluginRuntimeConfig.java:84-90`), i.e. storage plugins only. A query-index plugin that implements `QueryIndexStorageLocator` but is not also a storage plugin is not in that list. The SDK Javadoc says it is consumed by C-MOVE/WADO-RS (`QueryIndexStorageLocator.java:12-14`), but the implementation does not do that. See §1.3 and §10.
7. **`QueryIndexSettings` does not extend `QueryIndexPlugin`.** It is found by filtering `List<QueryIndexPlugin>` in `IndexSettingsController.java:25-31`, using `findFirst()`. A settings-only class must also implement `QueryIndexPlugin` (or another query-index extension) to be seen. Multiple settings providers are ambiguous.
8. **Dicoogle does not generically call `start()`/`stop()`.** Lifecycle is Spring bean lifecycle. The Lucene plugin opts in with `@Bean(initMethod = "start", destroyMethod = "stop")` (`LuceneQueryConfig.java:15`); other plugins do not. Generated code must use the same explicit opt-in.
9. **`apiVersion` is not `1.1` in the plugin contract.** The loader supports `{"1", "1.0"}` and only warns otherwise (`plugin-loader.ts:35`, `:102-106`). `CURRENT_VERSION = "1.1"` in `registry.ts:15` is the plugin-state localStorage schema version, not the plugin API version. Generated web plugins use `"1.0"`.
10. **Issue-58 is still unmerged.** Branch `fix/issue-58-plugin-registration` at `e62ba3e` changes `PluginMetadata` to `List<String> types` and deduplicates registration by id. It is not an ancestor of HEAD. HEAD still has a single `String type` (`PluginMetadata.java:14`) and blind append (`PluginRegistry.java:13-15`).

### 0.2 Locked decisions for this revision

These decisions supersede the earlier open questions and are applied throughout this document.

| # | Decision |
|---|---|
| D1 | Query-index `--locator` is dropped. The CLI rejects it with exit `2` and explains that only storage plugins feed `List<DicomInstanceLocator>` on HEAD. |
| D3 | Storage defaults to `enabled=false`, `scheme=<id>`. |
| D4 | Generated Java modules inherit the parent Maven version; they have no own `<version>`. |
| D5 | Metadata type tokens are the bundled `storage`, `query-index`, `service`, held in the single `{{pluginType}}` variable. |
| D6 | Repo id collisions: same namespace exits `4`; Java-vs-web collision is a warning. |
| D7 | No license header by default. `--license <SPDX>` emits one line: `// SPDX-License-Identifier: <SPDX>`. |
| D8 | Tests use the JUnit Jupiter API; generated POMs do not pin a JUnit version. |
| D9 | Pin data lives in `templates/lock.json`; template bodies live under `templates/`. |
| D10 | Generated Java stubs are minimal **working** stubs. They compile and their generated tests pass. TODO markers are explicit, but no exercised path throws `UnsupportedOperationException`. |
| D11 | `--out` may point inside dicoogle-next for a **new directory only**; the tool never edits existing files there. |
| D12 | Tool repo is `/home/jotalma13/Documents/Bolsa/dicoogle-plugin-bootstrap`. |
| D13 | Listener kind determines identity. `--ingest`: domain `query`, package `org.dicoogle.query.<id-without-hyphens>`, artifact `dicoogle-next-query-<id>`, prefix `app.query.<id>`, type `query-index`, suffix `IngestListener`. `--retrieve`: domain `service`, package `org.dicoogle.service.<id-without-hyphens>`, artifact `dicoogle-next-service-<id>`, prefix `app.service.<id>`, type `service`, suffix `RetrieveListener`. See §3.5 and §5.2. |

---

## 1. Verified extension points

### 1.1 Complete consumed set

All SDK interfaces live under `backend/dicoogle-next-sdk/src/main/java/org/dicoogle/sdk/`. Registration is Spring bean discovery from `org.dicoogle` (`DicoogleNextApplication.java:8-10`), not `ServiceLoader`, JSPF, or annotations.

| Extension point | Interface | Consumer / registration evidence | Consumed? |
|---|---|---|---|
| Lifecycle/base | `DicooglePlugin` (`DicooglePlugin.java:15-46`) | `metadata()` is required; `start()`/`stop()` are default methods. No generic framework invoker; Spring bean lifecycle is used explicitly. | Yes, through every plugin type |
| Storage base | `StoragePlugin` (`StoragePlugin.java:20-30`) | `List<StoragePlugin>` → `ActiveStoragePlugins` → `PluginRegistry`/`StorageRouter` (`PluginRuntimeConfig.java:41-90`) | Yes |
| Readable storage | `ReadableStoragePlugin` (`ReadableStoragePlugin.java:13-27`) | Same storage list; `StorageRouter` uses it | Yes |
| Writable storage | `WritableStoragePlugin` (`WritableStoragePlugin.java:13-30`) | Same storage list; `CStoreService` writes through `StorageRouter` | Yes |
| Listable storage | `ListableStoragePlugin` (`ListableStoragePlugin.java:17-39`) | `StorageRouter.findListable`; used by maintenance/indexing | Yes |
| Instance locator | `DicomInstanceLocator` (`DicomInstanceLocator.java:21-59`) | `List<DicomInstanceLocator>` built **only from storage plugins** (`PluginRuntimeConfig.java:84-90`); injected into DICOMweb retrieval/native-frame services | Yes, only as part of storage |
| Query/index marker | `QueryIndexPlugin` (`QueryIndexPlugin.java:31`) | `List<QueryIndexPlugin>` → `PluginRegistry` (`PluginRuntimeConfig.java:70-77`); also used by `IndexSettingsController` | Yes, as marker |
| Ingest events | `StorageIngestEventListener` (`StorageIngestEventListener.java:20-34`) | `List<StorageIngestEventListener>` into `CStoreService` (`CStoreService.java:35-70`, `:364`, `:382`) | Yes; DIMSE C-STORE only |
| Query | `QueryService` (`QueryService.java:27-97`) | `List<QueryService>` → `QueryRouter` (`PluginRuntimeConfig.java:109-113`) | Yes |
| Move | `QueryMoveService` (`QueryMoveService.java:23-66`) | `List<QueryMoveService>` → `QueryRouter` | Yes |
| Query + locator | `QueryIndexStorageLocator` (`QueryIndexStorageLocator.java:16`) | Matches `List<QueryIndexPlugin>`; for `DicomInstanceLocator` it is only present if the bean is also in the storage plugin list | **Partially**; see §1.3 |
| Maintenance | `QueryIndexMaintenance` (`QueryIndexMaintenance.java:6-14`) | `List<QueryIndexMaintenance>` in `QueryIndexMaintenanceService` (`QueryIndexMaintenanceService.java:15-19`) | Yes |
| Settings | `QueryIndexSettings` (`QueryIndexSettings.java:3-11`) | Filtered from `List<QueryIndexPlugin>`, `findFirst()` (`IndexSettingsController.java:25-31`) | Yes, if co-implemented with a query-index type |
| Service base | `ServicePlugin` (`ServicePlugin.java:12`) | No direct `List<ServicePlugin>` consumer | No, except via retrieve listener |
| Retrieve events | `StorageRetrieveEventListener` (`StorageRetrieveEventListener.java:12-26`) | `List<StorageRetrieveEventListener>` into `DicomwebRetrieveService` (`DicomwebRetrieveService.java:43`, `:48-56`, `:369`, `:382`) | Yes; DICOMweb only |
| DIMSE access policy | `DimseAccessPolicy<R>` (`DimseAccessPolicy.java:23-31`) | Three generic lists in `DimseCStoreConfig.java:45-103`; evaluated in `CFindService.java:157-163`, `CMoveService.java:135-141`, `DimseCStoreServer.java:335-341` | Yes |
| DIMSE association events | `DimseAssociationEventListener` (`DimseAssociationEventListener.java:22-51`) | `List<DimseAssociationEventListener>` into `DimseCStoreServer` (`DimseCStoreConfig.java:85-103`) | Yes; C-STORE server only |
| ML provider | `MlProviderPlugin` (`MlProviderPlugin.java:5`) | No consumer found | No |

There is **no** `PluginSet`, `IndexerInterface`, `JettyPluginInterface`, Restlet `ServerResource`, `PlatformCommunicatorInterface`, slot-id, or per-plugin XML settings in dicoogle-next. Do not generate them.

### 1.2 Confirmed Java families

| Family | Capability flags | Generated interfaces | Notes |
|---|---|---|---|
| `storage` | `--readable --writable --listable --locator` | `ReadableStoragePlugin`, `WritableStoragePlugin`, `ListableStoragePlugin`, `DicomInstanceLocator` | `--listable` implies `--readable`; `--locator` adds `DicomInstanceLocator`, not `QueryIndexStorageLocator` (avoids accidental query-index registration). Zero flags defaults to `--readable`. |
| `query-index` | `--ingest --query --move --maintenance --settings` | `StorageIngestEventListener`, `QueryService`, `QueryMoveService`, `QueryIndexMaintenance`, `QueryIndexSettings` | `--maintenance` extends `QueryIndexPlugin`; `--settings` alone must add `QueryIndexPlugin`. `QueryIndexStorageLocator` is not offered; `--locator` is rejected with exit `2` (D1). |
| `listener` | `--ingest` or `--retrieve` (exactly one) | `StorageIngestEventListener` or `StorageRetrieveEventListener` | Two different identities. `--ingest` is a registered query-index extension: domain `query`, prefix `app.query.<id>`, type `query-index`, suffix `IngestListener`. `--retrieve` is a service extension consumed only by DICOMweb: domain `service`, prefix `app.service.<id>`, type `service`, suffix `RetrieveListener`. |

**D1 applied:** the query-index family’s `--locator` is not independently useful on HEAD. `QueryIndexStorageLocator` remains an SDK type, but the CLI does not generate it from either family. A `query-index` invocation containing `--locator` exits `2` with the explanation that only storage plugins feed `List<DicomInstanceLocator>` (`PluginRuntimeConfig.java:84-90`). See §3.4 and §10, risk R6.

### 1.3 Important contract details

- **Metadata.** `PluginMetadata` is `record(id, name, version, type)` (`PluginMetadata.java:14`). `type` is a free-form string; bundled values are `"storage"` (`FileReadOnlyStoragePlugin.java:19-20`, `FileReadWriteStoragePlugin.java:33-34`) and `"query-index"` (`FileQueryIndexPlugin.java:50-51`, `LuceneQueryIndexPlugin.java:69-70`). The management UI filters on `index`, `query`, `storage` (`PluginSettings.tsx:14`, `:129-152`), so `"query-index"` does not match those tabs. This is a known drift, not a template error.
- **Registry.** `PluginRegistry.register` blindly appends on HEAD (`PluginRegistry.java:13-15`). A storage plugin that also implements `QueryIndexStorageLocator` can appear twice, which is why the generated storage `--locator` uses only `DicomInstanceLocator`.
- **Locator consumers.** The only `List<DicomInstanceLocator>` bean is derived from storage plugins (`PluginRuntimeConfig.java:84-90`). DICOMweb retrieval and native-frame services inject it (`DicomwebRetrieveService.java:40`, `NativeFrameService.java:40`).
- **Settings.** `IndexSettingsController` takes the first query-index plugin that implements `QueryIndexSettings` (`IndexSettingsController.java:25-31`). `QueryIndexMaintenanceService` selects by `indexId()` (`QueryIndexMaintenanceService.java:116-126`), so `indexId()` must be unique.
- **Lifecycle.** The Lucene config is the only bundled plugin that opts into `start`/`stop` (`LuceneQueryConfig.java:15`). Generated query-index and any lifecycle-bearing plugin must use the same `@Bean(initMethod = "start", destroyMethod = "stop")`.
- **Configuration.** Spring Boot YAML is the only backend config mechanism. Existing prefixes: `app.query.lucene`, `app.storage.file-ro`, `app.storage.file-rw`, `app.plugins.*` (`application.yml:119-142`; dev overrides `application-dev.yml:35-49`). There is no per-plugin settings file. Generated prefixes are family-specific: `app.storage.<id>`, `app.query.<id>`, `app.service.<id>`. For the listener family, the kind chooses `app.query.<id>` (ingest) or `app.service.<id>` (retrieve), matching the registration identity.

### 1.4 Descoped extension points

`DimseAccessPolicy` and `DimseAssociationEventListener` exist in
dicoogle-next and are consumed by the DIMSE stack, but they are intentionally
**not generated** by this tool:

- They are not present in classic Dicoogle, so the listener-only tool keeps the
  surface area aligned with the supported classic/next overlap.
- A generated access policy can deny requests when wired, which is a
  high-impact behavior change for a boilerplate generator.
- The listener family already covers the safe, read-only event hooks
  (`StorageIngestEventListener` and `StorageRetrieveEventListener`).

`--family dimse` exits `2` with `family not supported`. The DIMSE flags
`--access-policy`, `--policy-target`, and `--association-listener` are not
recognized.


---

## 2. CLI specification

### 2.1 Runtime and packaging

- Own repository: `/home/jotalma13/Documents/Bolsa/dicoogle-plugin-bootstrap`.
- Single zero-dependency Node ESM CLI, Node `>=20`.
- `package.json` is only for `bin`, `engines`, and test scripts; there are **no runtime dependencies**.
- Entry point: `bin/dicoogle-plugin-bootstrap.mjs`.
- Tests: built-in `node:test`; no Jest/Vitest.
- **No strong reason against zero dependencies.** Node’s `fs`, `path`, `process`, `readline/promises`, `crypto`, and `util` cover everything needed. The only cost is a hand-written argument parser and a small renderer; both are small, auditable, and avoid supply-chain risk. Do not add a template library.

### 2.2 Commands

```
dicoogle-plugin-bootstrap init                 # interactive wizard
dicoogle-plugin-bootstrap java  [flags]        # generate a Java Maven module
dicoogle-plugin-bootstrap web   [flags]        # generate a web UI plugin folder
dicoogle-plugin-bootstrap list                 # show families, hooks, pinned versions
dicoogle-plugin-bootstrap version              # tool + template-lock versions
```

`init` with no arguments starts the wizard. `java`/`web` with missing required arguments prompt only when stdin/stdout is a TTY; in non-TTY they exit `2`.

### 2.3 Common flags

| Flag | Default | Meaning |
|---|---|---|
| `--id <kebab>` | required | Canonical plugin id; drives metadata id, folder name, config prefix, package. |
| `--name <string>` | title-cased id | Human display name. |
| `--description <string>` | TODO text | Metadata description / README intro. |
| `--author <string>` | `Unknown` | Metadata author. |
| `--plugin-version <semver>` | `0.1.0` | `PluginMetadata.version` / web `version`; independent of Maven version. |
| `--out <path>` | Java: `./dicoogle-next-<domain>-<id>`; web: `./<id>` | Target directory. The tool writes only below this path. |
| `--force` | off | Allow a non-empty target. Existing generated files may be overwritten; unrelated files are never deleted. |
| `--dry-run` | off | Run all validation, render/compose in memory, run the post-render validators, then print only the file tree. No writes. Render/compose errors use the same exit codes as a real run. Non-empty target without `--force` still exits `3`. |
| `--repo <path>` | none | dicoogle-next checkout used only for plugin-id uniqueness scanning and template validation. Never modified. |
| `--license <SPDX\|none>` | `none` | Optional Java header. `none` means no header, matching current dicoogle-next. A value emits exactly one line at the top of each generated Java file: `// SPDX-License-Identifier: <SPDX>`. No full license boilerplate is generated (D7). |
| `--type <token>` | derived | Override `{{pluginType}}` without changing the rest of the template. |
| `--no-color` | auto | Disable ANSI color; also honors `NO_COLOR`. |
| `--verbose` | off | Print the resolved model and template hashes to stderr. |
| `--help`, `-h` | | Usage. |

`--id`, `--out`, and `--repo` are the only path-bearing flags. `--repo` is validated by checking for `backend/pom.xml`, `backend/dicoogle-next-sdk`, and `webapp/vite-plugins/plugin-loader.ts`; otherwise exit `2`.

### 2.4 Java flags

| Flag | Applies to | Meaning |
|---|---|---|
| `--family storage\|query-index\|listener` | all Java | Required. |
| `--readable --writable --listable --locator` | `storage` | Capabilities. Zero flags → `--readable`. `--listable` adds readable. `--locator` adds `DicomInstanceLocator`. |
| `--ingest --query --move --maintenance --settings` | `query-index` | At least one is required. `--settings` implies the `QueryIndexPlugin` marker. |
| `--locator` | `query-index` | **Rejected with exit `2`.** Only storage plugins feed `List<DicomInstanceLocator>` on HEAD (D1). |
| `--ingest` / `--retrieve` | `listener` | Exactly one is required. The two kinds use different domain/prefix/type/artifact mappings (§3.5). |
| `--package <pkg>` | Java | Override default `org.dicoogle.<domain>.<id-without-hyphens>`. |
| `--scheme <scheme>` | `storage` | Default is the plugin id. Must match `^[a-z][a-z0-9+.-]*$`. |

### 2.5 Web flags

| Flag | Default | Meaning |
|---|---|---|
| `--hooks <a,b>` | required | Comma-separated subset of `query-filter,result-options,result-batch,result-renderer,sidebar-menu,route,settings`. |
| `--type <token>` | derived | For one hook, the hook token; for multiple, `multi`. Stored in the single `{{pluginType}}` variable. |
| `--api-version <string>` | `1.0` | Must be `1` or `1.0`; anything else exits `2`. |

### 2.6 Examples

#### Java storage

```bash
dicoogle-plugin-bootstrap java \
  --family storage \
  --id my-dicom-store \
  --readable --writable --listable --locator \
  --name "My DICOM Store" \
  --out backend/plugins/dicoogle-next-storage-my-dicom-store \
  --repo /path/to/dicoogle-next
```

#### Java query-index

```bash
dicoogle-plugin-bootstrap java \
  --family query-index \
  --id my-index \
  --ingest --query --move --maintenance --settings \
  --out /tmp/my-index \
  --repo /path/to/dicoogle-next
```

#### Java listener

```bash
dicoogle-plugin-bootstrap java \
  --family listener \
  --id audit \
  --ingest \
  --out /tmp/audit
```

```bash
dicoogle-plugin-bootstrap java \
  --family listener \
  --id metrics \
  --retrieve \
  --out /tmp/metrics
```

The ingest example derives `org.dicoogle.query.audit`, `dicoogle-next-query-audit`, `app.query.audit`, type `query-index`, class `AuditIngestListener`. The retrieve example derives `org.dicoogle.service.metrics`, `dicoogle-next-service-metrics`, `app.service.metrics`, type `service`, class `MetricsRetrieveListener`. See §3.5 and §5.2.

#### Web, one example per hook

| Hook | Example command |
|---|---|
| `query-filter` | `dicoogle-plugin-bootstrap web --id date-range --hooks query-filter --out /tmp/date-range` |
| `result-options` | `dicoogle-plugin-bootstrap web --id download-study --hooks result-options --out /tmp/download-study` |
| `result-batch` | `dicoogle-plugin-bootstrap web --id download-batch --hooks result-batch --out /tmp/download-batch` |
| `result-renderer` | `dicoogle-plugin-bootstrap web --id gallery --hooks result-renderer --out /tmp/gallery` |
| `sidebar-menu` | `dicoogle-plugin-bootstrap web --id shortcuts --hooks sidebar-menu --out /tmp/shortcuts` |
| `route` | `dicoogle-plugin-bootstrap web --id reports --hooks route --out /tmp/reports` |
| `settings` | `dicoogle-plugin-bootstrap web --id my-settings --hooks settings --out /tmp/my-settings` |

Multi-hook:

```bash
dicoogle-plugin-bootstrap web \
  --id study-tools \
  --hooks route,sidebar-menu,settings \
  --name "Study Tools" \
  --out webapp/src/plugins/study-tools
```

### 2.7 Interactive mode

`dicoogle-plugin-bootstrap init`:

1. Target: Java or Web.
2. Java: family → capabilities → id → name → out → repo/license.
3. Web: hooks → id → name → out → repo.
4. Shows defaults in brackets, validates immediately, re-prompts on invalid input.
5. Shows a summary and asks to confirm.
6. Offers `--dry-run` before writing.
7. `Ctrl+C` exits `130`. In non-TTY, `init` exits `2` with instructions to use flags.

### 2.8 Dry-run output

Dry-run renders and composes the full plan in memory, runs the same post-render
validators as a real run, and only then prints the tree to stdout. Diagnostics
go to stderr. No files or temporary directories are written.

```
my-dicom-store/
  pom.xml
  README.md
  src/main/java/org/dicoogle/storage/mydicomstore/MyDicomStoreStoragePlugin.java
  src/main/java/org/dicoogle/storage/mydicomstore/MyDicomStoreStoragePluginConfig.java
  src/main/java/org/dicoogle/storage/mydicomstore/MyDicomStoreStoragePluginProperties.java
  src/test/java/org/dicoogle/storage/mydicomstore/MyDicomStoreStoragePluginTest.java
```

### 2.9 Exit codes

| Code | Meaning |
|---|---|
| `0` | Success (including a successful dry run). |
| `2` | Usage or validation error: unknown flag/command, invalid id/name/package/scheme, missing required flag, bad `--repo`, non-TTY interactive. |
| `3` | Target is non-empty or a generated path exists, without `--force`. |
| `4` | Plugin id collision found while scanning `--repo`. |
| `5` | Template lock missing/invalid, unknown placeholder, template hash mismatch, or unresolved template fragment. |
| `6` | I/O or internal error. |
| `7` | Unsupported runtime (Node < 20). |
| `130` | Interrupted by `SIGINT`. |

### 2.10 Safety rules

- There is **no `--wire` flag** and no automatic wiring. Wiring is documented in `WIRING.md` and the generated README.
- The CLI **only creates files** below `--out`. It never edits `backend/pom.xml`, `backend/dicoogle-next/pom.xml`, `application.yml`, `webapp/src/plugins`, or any existing source.
- `--repo` is read-only. It is used for id scanning and validation only.
- Refuse `--out` resolving to filesystem root or an existing regular file.
- Refuse to follow symlinks that escape `--out`.
- Write with `flag: "wx"` unless `--force`; with `--force`, overwrite only paths that the current plan produces.
- Reject ids containing `/`, `\`, `..`, control characters, or leading/trailing hyphens.
- Never run Maven, npm, git, or network requests. Verification is CI’s job.
- `--dry-run` writes nothing, including no temporary directories.

---

## 3. Template catalogue

### 3.1 Pin file and template storage

The **single pin file** is `templates/lock.json` in the tool repo. It records the pinned dicoogle-next commit, SDK/parent versions, dependency versions, reserved bundled plugin ids, template source paths, SHA-256 hashes, and declared placeholders. Template bodies live under `templates/` as plain files; the lock is the one file that must change when the baseline changes.

```json
{
  "schemaVersion": 1,
  "generatedBy": "dicoogle-plugin-bootstrap",
  "dicoogleNext": {
    "repository": "https://github.com/dicoogle/dicoogle-next",
    "commit": "cdfbff7f601d663453b9b7b77d6d3dc70af1b822",
    "branchAtPin": "feat/dissertation-frame-baseline",
    "javaVersion": "21",
    "mavenMinimum": "3.9.12",
    "springBootVersion": "4.0.3",
    "parentGroupId": "org.dicoogle",
    "parentArtifactId": "dicoogle-next-backend-parent",
    "parentVersion": "0.0.1-SNAPSHOT",
    "sdkArtifactId": "dicoogle-next-sdk",
    "sdkVersion": "0.0.1-SNAPSHOT",
    "dcm4cheVersion": "5.34.0",
    "webApiVersion": "1.0"
  },
  "templates": {
    "java/storage/Pom.xml.tmpl": {
      "source": "backend/plugins/dicoogle-next-storage-file-rw/pom.xml",
      "sha256": "<sha256>",
      "placeholders": ["parentVersion", "sdkVersion", "artifactId", "name", "description"]
    }
  }
}
```

If “one config file” is interpreted literally as template bodies inside one file, that is possible but not recommended: it makes Java fragments, web components, and docs unreadable and diff review poor. The design keeps pin data in one file and bodies in a typed tree.

### 3.2 Placeholders

| Placeholder | Derivation | Example |
|---|---|---|
| `{{id}}` | validated canonical id | `my-dicom-store` |
| `{{name}}` | `--name` or title-cased id | `My DICOM Store` |
| `{{description}}` | `--description` or TODO text | `TODO: describe ...` |
| `{{author}}` | `--author` or `Unknown` | `Dicoogle Team` |
| `{{pluginVersion}}` | `--plugin-version` | `0.1.0` |
| `{{apiVersion}}` | web only, `1.0` | `1.0` |
| `{{package}}` | `--package` or default | `org.dicoogle.storage.mydicomstore` |
| `{{packagePath}}` | `package` with `.` → `/` | `org/dicoogle/storage/mydicomstore` |
| `{{ClassName}}` | Pascal(id) + family suffix | `MyDicomStoreStoragePlugin` |
| `{{artifactId}}` | `dicoogle-next-<domain>-<id>` | `dicoogle-next-storage-my-dicom-store` |
| `{{domain}}` | family domain; listener kind decides `query` vs `service` | `storage`, `query`, `service` |
| `{{pluginType}}` | single metadata type token | `storage`, `query-index`, `service`, `multi` |
| `{{configPrefix}}` | `app.<domain>.<id>` | `app.storage.my-dicom-store` |
| `{{configName}}` | id | `my-dicom-store` |
| `{{scheme}}` | `--scheme` or id | `my-dicom-store` |
| `{{entry}}` | web entry file, always `index.ts` | `index.ts` |
| `{{hookList}}` | comma-joined web hooks | `route,sidebar-menu` |
| `{{licenseHeader}}` | empty, or one `// SPDX-License-Identifier: ...` line | `// SPDX-License-Identifier: GPL-3.0-only` |
| `{{licenseSpdx}}` | `--license` | `GPL-3.0-only` |
| `{{parentVersion}}` | lock | `0.0.1-SNAPSHOT` |
| `{{sdkVersion}}` | lock | `0.0.1-SNAPSHOT` |
| `{{dcm4cheVersion}}` | lock | `5.34.0` |
| `{{springBootVersion}}` | lock | `4.0.3` |
| `{{javaVersion}}` | lock | `21` |

Rules:

- Unknown placeholders are a fatal render error (exit `5`), never passed through.
- `{{id}}` is never transformed inside a placeholder. All derived values are computed before rendering.
- `{{pluginType}}` is the **only** metadata-type variable in Java and web templates. A future switch to `List<String> types` changes one template expression, not every file.
- XML contexts use escaped values. The POM template consumes `{{nameXml}}` and
  `{{descriptionXml}}`, produced by escaping `&`, `<`, `>`, `"`, and `'`.
  Markdown/Java contexts keep the raw `{{name}}` and `{{description}}`.

### 3.3 Java storage files

| Generated file | Source in dicoogle-next | Variation |
|---|---|---|
| `pom.xml` | `backend/plugins/dicoogle-next-storage-file-rw/pom.xml:1-45`; parent pattern also in `backend/plugins/dicoogle-next-storage-file-ro/pom.xml:1-27` | Always; dependencies adjusted by capabilities (SDK always; Spring always because config/properties; JUnit test). |
| `src/main/java/{{packagePath}}/{{ClassName}}.java` | `backend/plugins/dicoogle-next-storage-file-ro/src/main/java/org/dicoogle/storage/filero/FileReadOnlyStoragePlugin.java:16-136`; `.../dicoogle-next-storage-file-rw/.../FileReadWriteStoragePlugin.java:25-236` | Capability fragments: readable, writable, listable, locator. |
| `.../{{ClassName}}Config.java` | `.../dicoogle-next-storage-file-rw/.../FileReadWriteStorageConfig.java:9-17` | Always. `@Configuration`, `@EnableConfigurationProperties`, `@Bean`, `@ConditionalOnProperty`. |
| `.../{{ClassName}}Properties.java` | `.../dicoogle-next-storage-file-rw/.../FileReadWriteStorageProperties.java:5-34` | Always. `enabled`, `rootDir`, `scheme`. |
| `src/test/java/{{packagePath}}/{{ClassName}}Test.java` | `.../dicoogle-next-storage-file-rw/src/test/java/.../FileReadWriteStoragePluginTest.java:18-72` | Always. Direct instantiation, `@TempDir`, metadata/scheme test, plus passing capability tests: store/read round trip (writable+readable), list children (listable), locate an object placed by the test or stored by the stub (locator). Also includes `ApplicationContextRunner` checks that `enabled=true` registers the plugin bean with the expected id/type and that the default (`enabled=false`) registers nothing. The generated stub is a working temp-directory implementation, not a throwing placeholder. |
| `README.md` | New template; style from `backend/README.md` and `webapp/README.md` | Always. Contains the only YAML snippet; wiring and TODO list. |

Storage class composition:

- Always `implements StoragePlugin` through one concrete storage interface.
- `--readable` → `ReadableStoragePlugin`, `openForRead`.
- `--writable` → `WritableStoragePlugin`, `store`.
- `--listable` → `ListableStoragePlugin` (which already extends `ReadableStoragePlugin`), `listChildren`, `isDirectory`; do not also list `ReadableStoragePlugin`.
- `--locator` → `DicomInstanceLocator`, `locateInstance`, `listStudyInstances`, `listSeriesInstances`.
- If no concrete storage interface is selected (zero flags or only `--locator`), readable is added so the class still implements a concrete `StoragePlugin`.
- Do **not** add `QueryIndexStorageLocator` to storage output; that would register the plugin as query-index and risk duplicate registration on HEAD.
- Every generated method body is a minimal working temp-directory implementation per §3.10; no exercised method throws.

### 3.4 Java query-index files

| Generated file | Source in dicoogle-next | Variation |
|---|---|---|
| `pom.xml` | `backend/plugins/dicoogle-next-query-file/pom.xml:1-45`; lifecycle/deps pattern from `.../dicoogle-next-query-lucene/pom.xml:1-61` | Always; SDK + Spring + JUnit; dcm4che-core test scope only for tests that construct `Attributes`. |
| `.../{{ClassName}}.java` | `backend/plugins/dicoogle-next-query-file/src/main/java/org/dicoogle/query/file/FileQueryIndexPlugin.java:46-488`; full-featured methods from `.../dicoogle-next-query-lucene/.../LuceneQueryIndexPlugin.java:60-430` | Fragments: ingest, query, move, maintenance, settings. |
| `.../{{ClassName}}Config.java` | `.../dicoogle-next-query-lucene/.../LuceneQueryConfig.java:11-25` | Always; uses `@Bean(initMethod = "start", destroyMethod = "stop")` and `@EnableConfigurationProperties`. |
| `.../{{ClassName}}Properties.java` | `.../dicoogle-next-query-lucene/.../LuceneQueryProperties.java:5-70` | Always; simplified to `enabled`, `rootDir`, `indexName`, `watchEnabled`. |
| `src/test/java/.../{{ClassName}}Test.java` | `.../dicoogle-next-query-file/src/test/java/.../FileReadWriteDimseFindPluginTest.java:24-100`; `.../dicoogle-next-query-lucene/src/test/java/.../LuceneQueryIndexPluginTest.java:29-104` | Always; `@TempDir`, direct instantiation, metadata, and one passing test per selected capability. The stub uses an in-memory index; ingest/query/move/maintenance/settings tests exercise real stub behavior, not throwing placeholders. Includes `ApplicationContextRunner` checks for `enabled=true`/`enabled=false` and verifies the bean is visible as `StorageIngestEventListener`, `QueryService`, `QueryMoveService`, `QueryIndexMaintenance`, or `QueryIndexSettings` where applicable. |
| `README.md` | New template | Always; YAML, semantics, TODO. |

Query-index composition:

- `--ingest` → `StorageIngestEventListener`, `onIngestSuccess`/`onIngestFailure`.
- `--query` → `QueryService`, `query`.
- `--move` → `QueryMoveService`, `resolve`.
- `--maintenance` → `QueryIndexMaintenance` (`indexId`, `indexedDocuments`, `indexPath`, `unindexPath`); already a `QueryIndexPlugin`.
- `--settings` → `QueryIndexSettings` (`getIndexPath`, `setIndexPath`, `isWatchEnabled`, `setWatchEnabled`) plus the `QueryIndexPlugin` marker if no other query-index capability is selected.
- At least one flag is required. Empty selection is exit `2`.
- `--locator` is always rejected with exit `2` and the message that only storage plugins feed `List<DicomInstanceLocator>` (D1). There is no compatibility flag in v1.
- `QueryIndexMaintenance.indexId()` defaults to the validated plugin id so generated indexes are unique by default.
- Every selected method body is a minimal working in-memory implementation per §3.10; no exercised method throws.

### 3.5 Java listener files

Listener is one CLI family but two different plugin identities. D13 resolves the inconsistency: each kind gets its own domain, package, artifactId, config prefix, metadata type, and class suffix, aligned with how the code registers and consumes it.

| Kind | Domain | Package | ArtifactId | Config prefix | Metadata type | Class suffix |
|---|---|---|---|---|---|---|
| `--ingest` | `query` | `org.dicoogle.query.<id-without-hyphens>` | `dicoogle-next-query-<id>` | `app.query.<id>` | `query-index` | `IngestListener` |
| `--retrieve` | `service` | `org.dicoogle.service.<id-without-hyphens>` | `dicoogle-next-service-<id>` | `app.service.<id>` | `service` | `RetrieveListener` |

Rationale, verified in code:

- `StorageIngestEventListener extends QueryIndexPlugin` (`StorageIngestEventListener.java:20`), so the bean is collected by `List<QueryIndexPlugin>` and registered in `PluginRegistry` (`PluginRuntimeConfig.java:70-77`). It is consumed by `CStoreService` (`CStoreService.java:35-70`, `:364`, `:382`).
- `StorageRetrieveEventListener extends ServicePlugin` (`StorageRetrieveEventListener.java:12`), **not** `QueryIndexPlugin`. It is not in `PluginRegistry`; it is consumed only by `DicomwebRetrieveService` (`DicomwebRetrieveService.java:43`, `:48-56`, `:369`, `:382`).

| Generated file | Source in dicoogle-next | Variation |
|---|---|---|
| `pom.xml` | `backend/plugins/dicoogle-next-storage-file-ro/pom.xml:1-27` plus Spring pattern | SDK + Spring + JUnit. `artifactId` follows the kind mapping above. |
| `.../{{ClassName}}.java` | SDK contract only: `StorageIngestEventListener.java:20-34` and `CStoreService.java:35-70`, `:364`, `:382`; or `StorageRetrieveEventListener.java:12-26` and `DicomwebRetrieveService.java:43`, `:369`, `:382` | `--ingest` → `<Pascal>IngestListener`; `--retrieve` → `<Pascal>RetrieveListener`. No concrete bundled implementation exists; this is **derived**, not a snapshot. |
| `.../{{ClassName}}Config.java` | `FileReadWriteStorageConfig.java:9-17` pattern | `@Configuration`, `@EnableConfigurationProperties`, `@Bean`, `@ConditionalOnProperty` using the kind-specific prefix. |
| `.../{{ClassName}}Properties.java` | `FileReadWriteStorageProperties.java:5-34` simplified | `enabled` only. |
| `src/test/java/.../{{ClassName}}Test.java` | New test, following direct-instantiation style | Constructs the relevant event record and calls the callback. The working stub records the event (e.g. last event/count field), and the test asserts the recorded value. No exercised callback throws. |
| `README.md` | New template | Explains the C-STORE vs DICOMweb scope and the kind-specific YAML prefix. |

`--ingest` class implements `StorageIngestEventListener` and has metadata type `query-index`. `--retrieve` class implements `StorageRetrieveEventListener` and has metadata type `service`; it is not in `PluginRegistry`. The YAML snippet in the generated README uses `app.query.<id>` for ingest and `app.service.<id>` for retrieve. Both listener stubs record events in fields and are exercised by passing tests per §3.10.

### 3.6 DIMSE files (descoped)

DIMSE generation is intentionally not offered. No `DimseAccessPolicy` or
`DimseAssociationEventListener` templates, flags, validation, tests, or plans
are generated. See §1.4 for rationale.

### 3.7 Web files

`index.ts` is always the entry (never `index.tsx`). Icons are built with `createElement` so the entry stays JSX-free and composition is deterministic. Component files are `.tsx`.

| Hook | Generated files | Source in dicoogle-next |
|---|---|---|
| all | `plugin.config.json`, `index.ts`, `README.md` | Config schema from `plugin-loader.ts:11-24`, `:41-129`; examples’ `plugin.config.json` |
| `query-filter` | `{{ClassName}}Filter.tsx` | `webapp/docs/Examples/date-filter-plugin/index.ts:11-73`, `DateRangeFilter.tsx:9-13` |
| `result-options` | no component | `webapp/docs/Examples/download-plugin/index.tsx:102-163` |
| `result-batch` | no component | `webapp/docs/Examples/download-plugin/index.tsx:165-292` |
| `result-renderer` | `{{ClassName}}Renderer.tsx` | `webapp/docs/Examples/gallery-view-plugin/index.ts:16-37`, `GalleryView.tsx:24-64` |
| `sidebar-menu` | no component | `webapp/docs/Examples/hello-plugin/index.ts:30-37`; `analytics-plugin/index.ts:57-65` |
| `route` | `{{ClassName}}Page.tsx` | `webapp/docs/Examples/hello-plugin/index.ts:22-28`, `HelloComponent.tsx:8-15`; `analytics-plugin/index.ts:49-55` |
| `settings` | `{{ClassName}}Settings.tsx` | `webapp/docs/Examples/plugin-manager-settings/index.tsx:12-26`, `PluginManagerSettings.tsx:11-30` |

Web composition:

- `index.ts` imports only what is used: `WebUIPlugin`, the extension type, `createElement` (if any icon), and `lazy` (if any component).
- Each hook contributes an optional method fragment. No empty methods are emitted.
- Components receive the exact props from `types.ts`: `QueryFilterProps`, `ResultRendererProps`; route/settings components take no props.
- No `metadata` object in `index.ts`; metadata lives in `plugin.config.json` and overrides anything absent (`registry.ts:75-103`).
- `plugin.config.json`:

```json
{
  "id": "{{id}}",
  "entry": "index.ts",
  "apiVersion": "1.0",
  "enabled": true,
  "name": "{{name}}",
  "version": "{{pluginVersion}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "type": "{{pluginType}}"
}
```

- No `package.json`, no build config, no bundle. The host Vite build compiles it (`plugin-loader.ts:254-323`, `:350-353`).
- The generated README is the only place with wiring instructions.

### 3.8 Enablement defaults

All Java templates use `@ConditionalOnProperty(prefix = "{{configPrefix}}", name = "enabled", havingValue = "true", ...)`.

| Family | `enabled` default | `matchIfMissing` | YAML prefix |
|---|---|---|---|
| storage | `false` | `false` (must opt in) | `app.storage.<id>` |
| query-index | `false` | `false` (must opt in) | `app.query.<id>` |
| listener `--ingest` | `false` | `false` (must opt in) | `app.query.<id>` |
| listener `--retrieve` | `false` | `false` (must opt in) | `app.service.<id>` |

All generated families must opt in. Storage defaults to disabled because a second storage plugin with a colliding scheme can change routing; its default scheme is the plugin id, not `file`. Query-index and listener default to disabled because the current stubs record data but do not implement request matching, and `QueryRouter` fans queries out to all enabled providers. Generated READMEs tell users to set `enabled: true` to activate a module.

### 3.9 Generated READMEs

Every generated module/folder includes a `README.md` with:

- What was generated and which capabilities/hooks are active.
- The YAML snippet for Java (the only place the snippet is written).
- Build/test commands.
- Manual wiring steps (from `WIRING.md`).
- The exact dicoogle-next commit and SDK version used.
- TODOs for the developer’s specific logic.
- License note when `--license` was used; generated Java files then start with one `// SPDX-License-Identifier: ...` line.

### 3.10 Stub policy (D10)

Generated Java stubs are **minimal working implementations**, not placeholders that throw.

| Family | Working stub behavior | Generated test proves |
|---|---|---|
| storage readable | Reads bytes from `rootDir` using the URI/path convention used by the stub. | A file written by the test is read back. |
| storage writable | Writes bytes under `rootDir` with a safe generated name and returns a `StoredObject`. | `store()` returns an existing location with the expected byte count. |
| storage listable | Lists direct children and reports directories. | A directory with a file lists that file. |
| storage locator | Finds an object placed by the test under `rootDir` using the stub’s path convention; returns `Optional.empty()` for unknown ids. | Placed object is located; unknown object returns empty. |
| query-index ingest | Records entries in an in-memory map exposed only through package-private accessors. | Ingest an event, then assert the recorded count. |
| query-index query/move | Returns an empty list with a TODO explaining which request fields to match. Never returns recorded entries unrelated to the request. | Seed/ingest an entry, then assert query/move returns empty while the recorded count stays. |
| query-index maintenance | `indexedDocuments()` counts its own maintained-path set; `indexPath` adds a path and `unindexPath` removes it. It never writes the ingest map or query/move results. | Count changes after `indexPath`/`unindexPath`; ingest `indexSize()` stays zero. |
| query-index settings | Reads/writes the generated properties object. | Getter reflects setter values. |
| listener ingest/retrieve | Records the last event and a count inside an exception-safe callback that catches/logs `RuntimeException` and never rethrows. | Construct an event, call the callback, assert the recorded event; subclass a helper to throw and assert the callback does not escape. |

Rules:

- No generated test may exercise a method that throws `UnsupportedOperationException`.
- No generated stub uses `UnsupportedOperationException` as its method body.
- TODOs mark where the developer replaces the working stub with real logic.
- A stub may be deliberately simple (temp directory or in-memory map), but it must compile, run, and pass its generated test against the pinned SDK.
- Generated web components are also minimal but functional: they render, use the correct props, and pass lint/type-check/build.

---

## 4. Template engine approach

### 4.1 Two layers: model/plan first, text render second

Do not build Java or TypeScript by concatenating arbitrary conditional text. Use two layers:

1. **Model/plan layer (JavaScript, deterministic).**
   - Parse flags into a typed model: family, capabilities, hooks, names, ids, versions.
   - Apply closure rules (e.g. `--listable` implies readable; `--settings` implies `QueryIndexPlugin`).
   - Produce an ordered list of output files, each with a template id and a data object.
   - Produce a fragment model for class/entry composition: imports, interfaces, fields, methods, tests.

2. **Render layer (small, strict).**
   - Whole-file templates use a tiny renderer with only:
     - `{{var}}` interpolation,
     - `{{#if key}}...{{/if}}`,
     - `{{#unless key}}...{{/unless}}`,
     - `{{#each list}}...{{/each}}`.
   - No arbitrary expressions, no function calls, no nested templates loaded at runtime.
   - Unknown variable or unmatched block → exit `5`.
   - The renderer and the lock verifier share `src/template-syntax.mjs` for tokenization and placeholder extraction; they must not maintain separate tokenizers.
   - Inside `{{#each list}}`, the current item is exposed as `{{this}}`; object items also expose their own properties.
   - Java class bodies and `index.ts` bodies are **not** monolithic conditional templates; they are generated from fragments by the composer. Conditional blocks are reserved for invariant files (POM, config, README, `plugin.config.json`).

Why: capability combinations are where generators usually produce uncompilable code. Fragment composition lets the generator validate that every selected interface has its required methods before writing.

### 4.2 Fragment manifests

Each Java capability declares:

```js
{
  id: "storage.locator",
  imports: ["java.net.URI", "java.util.List", "java.util.Optional",
            "org.dicoogle.sdk.storage.DicomInstanceLocator"],
  interfaces: ["DicomInstanceLocator"],
  fields: [],
  methods: ["locateInstance", "listStudyInstances", "listSeriesInstances"],
  tests: ["locatorReturnsEmptyWhenUnknown"]
}
```

The composer:

- Adds imports only if the simple type name appears in the final body.
- Deduplicates imports and interfaces.
- Sorts imports in Google Java Format order.
- Emits `@Override` for every interface method.
- Fails if a selected interface has no corresponding method fragment.
- Fails if two fragments define the same method signature.
- Fails if the class does not implement `DicooglePlugin` (directly or indirectly) when metadata is required.
- Derives the Spring bean method name from the generated class name in lowerCamelCase (`MyAuditIngestListener` -> `myAuditIngestListener`), so different plugin ids produce different bean names.

Web hook fragments work the same way: each hook contributes its method, imports, and optional component file. The composer deduplicates `createElement`/`lazy`/type imports.

### 4.3 Composition rules (compile-safety contract)

| Family | Rule |
|---|---|
| storage | Always one concrete storage interface (`ReadableStoragePlugin`, `WritableStoragePlugin`, or `ListableStoragePlugin`). `--listable` subsumes `--readable`. `--locator` adds `DicomInstanceLocator` methods. Never add `QueryIndexStorageLocator` from the storage family. |
| query-index | At least one of ingest/query/move/maintenance/settings. `--settings` alone adds `QueryIndexPlugin`. `--maintenance` already extends `QueryIndexPlugin`. No `--locator`. |
| listener | Exactly one of `--ingest`/`--retrieve`. Ingest emits `StorageIngestEventListener` with `query` domain, `app.query.<id>`, type `query-index`, `IngestListener`; retrieve emits `StorageRetrieveEventListener` with `service` domain, `app.service.<id>`, type `service`, `RetrieveListener`. The two mappings are applied before rendering, so no file mixes identities. |
| web | Hooks are independent methods on one default-exported object. Any subset is valid. Components only for query-filter, result-renderer, route, settings. Icons are `createElement` so entry stays `index.ts`. |

### 4.4 Post-render validators

Before writing (and during `--dry-run`):

- No remaining `{{...}}` tokens.
- No duplicate output paths.
- Package declaration matches `{{package}}`; file path matches package.
- Exactly one public top-level type per Java file; file name equals public type.
- Balanced braces/parentheses/angle brackets in generated Java and TS.
- Every import’s simple name occurs in the body (prevents unused imports under Spotless/TS strict).
- Every selected interface method is present.
- Every generated test class ends in `Test` (Surefire default).
- Web: `plugin.config.json` parses, `entry` exists, `id` matches folder, `apiVersion` is `1.0`.
- Web: no `package.json` is emitted.
- File encoding UTF-8, LF endings, final newline.

The final guarantee is compilation in CI; the validators are fast local feedback, not a replacement for `mvn`/`tsc`.

### 4.5 Google Java Format compliance

- Templates are stored pre-formatted in GOOGLE style.
- The composer emits the same canonical shape as google-java-format (2-space indent, 100-column wrap, one import per line, no wildcard imports, no trailing spaces, final newline).
- No runtime dependency on google-java-format; the tool does not mutate files after writing.
- CI runs `mvn spotless:check` **before** any bound `spotless:apply` execution and additionally hashes generated files before/after `mvn test` to prove no rewrite occurred.
- Any generator change that causes Spotless to rewrite the fixture is a failing test.

---

## 5. Name, ID, and case-conversion rules

### 5.1 Canonical plugin id

```
^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$
```

- Length 1–64.
- Lowercase kebab-case only.
- No leading/trailing hyphen, no consecutive hyphens.
- No path separators, `..`, whitespace, underscores, dots, or control characters.
- Must not be a Java reserved word when hyphen-stripped (e.g. `class`, `record`, `package`, `var`, `yield`, `sealed`, `permits`).
- Must not equal a reserved bundled plugin id from `templates/lock.json` (`reservedPluginIds`): `lucene`, `query-file-rw`, `storage-file-ro`, `storage-file-rw`. QueryRouter keys providers by `metadata().id()` and a duplicate silently overwrites the earlier plugin (`QueryRouter.java:202-210`), so these ids exit `2`.
- Names that normalize to the same package (e.g. `foo-bar` and `foobar`) are flagged with a warning because the Java package would collide.

Invalid input is rejected with a suggested valid form; it is never silently changed.

### 5.2 Conversions

| Output | Rule | Example for `my-dicom-store` |
|---|---|---|
| `id` | input | `my-dicom-store` |
| Directory (default) | Java: artifactId; web: id | `dicoogle-next-storage-my-dicom-store` / `my-dicom-store` |
| `artifactId` | `dicoogle-next-<domain>-<id>` | `dicoogle-next-storage-my-dicom-store` |
| `package` | `org.dicoogle.<domain>.<id without hyphens>` | `org.dicoogle.storage.mydicomstore` |
| `packagePath` | package with `/` | `org/dicoogle/storage/mydicomstore` |
| Pascal | split on `-`, capitalize first letter, lowercase rest | `MyDicomStore` |
| `ClassName` | Pascal + family suffix | `MyDicomStoreStoragePlugin` |
| `configPrefix` | `app.<domain>.<id>` | `app.storage.my-dicom-store` |
| `scheme` | `--scheme` or id | `my-dicom-store` |
| `pluginType` | family/kind token | `storage` |

Listener-kind overrides (D13; id `my-audit` shown):

| Kind | Domain | ArtifactId | Package | Config prefix | `pluginType` | `ClassName` |
|---|---|---|---|---|---|---|
| `--ingest` | `query` | `dicoogle-next-query-my-audit` | `org.dicoogle.query.myaudit` | `app.query.my-audit` | `query-index` | `MyAuditIngestListener` |
| `--retrieve` | `service` | `dicoogle-next-service-my-audit` | `org.dicoogle.service.myaudit` | `app.service.my-audit` | `service` | `MyAuditRetrieveListener` |

Class suffixes:

| Family / capability | Suffix |
|---|---|
| storage | `StoragePlugin` |
| query-index | `QueryIndexPlugin` |
| listener ingest | `IngestListener` |
| listener retrieve | `RetrieveListener` |

Config/properties/test names derive from `ClassName`: `<ClassName>Config`, `<ClassName>Properties`, `<ClassName>Test`.

### 5.3 Other validation

- `--name`: 1–80 printable characters, no newlines; default title-case id.
- `--description`: 1–200 printable characters; default TODO.
- `--author`: 1–80 printable characters; default `Unknown`.
- `--plugin-version`: semver-like `^\d+\.\d+\.\d+(?:[-+].*)?$`; default `0.1.0`.
- `--package`: `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`; every segment must be a valid non-reserved Java identifier.
- `--scheme`: `^[a-z][a-z0-9+.-]*$`; default id.
- `--api-version`: only `1` or `1.0`.
- `--hooks`: subset of the seven supported hooks, no duplicates; at least one.
- `--license`: `none` or a non-empty SPDX identifier without whitespace/newlines (at most 64 characters). It emits one comment line, never a full license body.
- `--out`: may resolve inside dicoogle-next only if the final target is a new directory; the tool never writes into an existing repository file (D11).

### 5.4 Plugin-id uniqueness

Only when `--repo <dicoogle-next>` is given:

- Java: scan `backend/plugins/**/src/main/java/**/*.java` for `new PluginMetadata("...")` and collect ids. Tests and `target/` are ignored.
- Web: scan `webapp/src/plugins/*/plugin.config.json` ids. `webapp/docs/Examples` is not the live plugin directory; it may be scanned with `--verbose` as a warning only.
- Same-namespace collision → exit `4`.
- Cross-namespace collision (Java id equals web id) → warning, because backend and web registries are separate. Configurable to error later.
- The scan is regex-based and documented as heuristic; generated code uses a literal `new PluginMetadata("{{id}}", ...)`, so it is reliable for generated plugins.

---

## 6. Parent POM strategy

### 6.1 What the existing plugin POMs do

All four bundled plugins use the same shape:

- Parent `org.dicoogle:dicoogle-next-backend-parent:0.0.1-SNAPSHOT` with `<relativePath>../../pom.xml</relativePath>` (`backend/plugins/dicoogle-next-storage-file-ro/pom.xml:6-11`, `.../storage-file-rw/pom.xml:6-11`, `.../query-file/pom.xml:6-11`, `.../query-lucene/pom.xml:6-11`).
- SDK dependency `org.dicoogle:dicoogle-next-sdk:${project.version}` (`.../storage-file-ro/pom.xml:17-23`, etc.).
- Spring context/autoconfigure and dcm4che dependencies as needed (`.../storage-file-rw/pom.xml:24-37`, `.../query-file/pom.xml:24-38`).
- JUnit test scope (`.../storage-file-rw/pom.xml:38-42`).
- No `<version>` on the module, so the module version inherits `0.0.1-SNAPSHOT` from the parent.

### 6.2 Generated POM contract

Every generated Java module uses:

```xml
<parent>
  <groupId>org.dicoogle</groupId>
  <artifactId>dicoogle-next-backend-parent</artifactId>
  <version>{{parentVersion}}</version>
  <relativePath>../../pom.xml</relativePath>
</parent>
```

and no module `<version>`, so Maven coordinates stay consistent with the bundled plugins and `${project.version}` equals the SDK version.

Dependencies by family:

| Family | Compile | Test |
|---|---|---|
| storage | SDK; `spring-context`; `spring-boot-autoconfigure` | `junit-jupiter`; `spring-boot-test` (required to compile `ApplicationContextRunner` use); `assertj-core` |
| query-index | SDK; `dcm4che-core`; `spring-context`; `spring-boot-autoconfigure` | `junit-jupiter`; `spring-boot-test`; `assertj-core` |
| listener | SDK; `spring-context`; `spring-boot-autoconfigure` | `junit-jupiter`; `spring-boot-test`; `assertj-core` (required to compile `ApplicationContextRunner` use) |

Do not add shade/assembly, `Main-Class`, relocation, or a custom `finalName`. No bundled backend POM uses them, and plugin jars are plain Maven jars baked into the Spring Boot fat jar (`backend/plugins/*/target/*.jar`; `backend/dicoogle-next/target/*.jar`).

### 6.3 Why `../../pom.xml` and how “any --out path” works

Maven behavior was verified locally with Maven 3.9.12:

- A child with `<relativePath/>` in a reactor **fails** if the parent is not installed:
  - `Non-resolvable parent POM ... 'parent.relativePath' points at no local POM`.
- A child with `<relativePath>../../pom.xml</relativePath>` builds in the reactor when the parent is at that location.
- If `../../pom.xml` does not exist, Maven falls back to the local repository (so a locally installed parent/SDK is enough for a standalone module).
- If `../../pom.xml` exists but has a different GAV, Maven fails with “parent.relativePath points at wrong local POM”.

Therefore:

- Always emit `<relativePath>../../pom.xml</relativePath>`.
- Before writing, resolve `path.resolve(out, "../../pom.xml")`:
  - If it does not exist → standalone mode; require the parent to be installed and say so in the README.
  - If it exists and its GAV matches `org.dicoogle:dicoogle-next-backend-parent:{{parentVersion}}` → in-repo/reactor mode.
  - If it exists with a different GAV → exit `2` with a message to choose another `--out` or remove the conflicting POM. This prevents accidentally inheriting an unrelated parent.
- If the generated module is later copied to `backend/plugins/<artifactId>`, the same relative path is correct.
- `--out` is not required to be under `backend/plugins`; an arbitrary path works as long as the check above passes.

### 6.4 Standalone build against a locally installed SDK

Documented in every generated Java README and in `WIRING.md`:

```bash
# from a dicoogle-next checkout at the pinned commit
cd backend
./mvnw -B -ntp -N install
./mvnw -B -ntp -pl dicoogle-next-sdk -am install

# then, from the generated module
mvn -B -ntp spotless:check test
```

The parent and SDK are `0.0.1-SNAPSHOT`; no remote repository is declared for them. Remote publication is **UNVERIFIED** and outside this design.

### 6.5 In-repo build

Manual wiring only:

1. Copy/generate the module to `backend/plugins/<artifactId>`.
2. Add `<module>plugins/<artifactId></module>` to `backend/pom.xml` (`backend/pom.xml:21-32`).
3. Add a dependency on `<artifactId>` to `backend/dicoogle-next/pom.xml` (`backend/dicoogle-next/pom.xml:58-77`).
4. Build: `./mvnw -B -ntp -pl plugins/<artifactId> -am test` or full `./mvnw -B -ntp clean verify`.
5. Rebuild the app fat jar.

The tool never performs steps 2–3.

---

## 7. Tool repository layout, pinning, and refresh

### 7.1 Layout

```
dicoogle-plugin-bootstrap/
  package.json                 # type=module, bin, engines>=20, scripts; zero dependencies
  bin/
    dicoogle-plugin-bootstrap.mjs
  src/
    cli.mjs                    # command dispatch, help, version
    args.mjs                   # hand-written parser
    errors.mjs                 # error types + exit codes
    interactive.mjs            # readline/promises wizard
    validate.mjs               # id/name/package/scheme/version rules
    naming.mjs                 # case conversions and derived values
    parent.mjs                 # parent POM target/GAV validation
    model.mjs                  # family/hook model + closure rules
    plan.mjs                   # ordered file plan + materialization
    template-syntax.mjs        # shared tokenizer/placeholder extractor
    render.mjs                 # {{var}}, {{#if}}, {{#unless}}, {{#each}}
    java/compose.mjs           # Java fragment composer + validators
    java/fragments/            # capability method/import/test fragments
    web/compose.mjs            # web hook composer
    web/fragments/             # hook method/import/component fragments
    fs.mjs                     # safe writes, dry-run tree, --force
    repo-scan.mjs              # --repo id uniqueness scan
    lock.mjs                   # template lock loading + hash checks
  templates/
    lock.json                  # single pin file
    java/...                   # whole-file templates
    web/...                    # whole-file templates, components
    docs/                      # README.java.md, README.web.md, WIRING.md
  scripts/
    verify-templates.mjs       # hashes, placeholders, no drift
    refresh-templates.mjs      # snapshot update (developer-only)
    build-fixtures.mjs         # CI helper matrix
  test/                        # node:test unit + snapshot tests
  fixtures/                    # expected trees/snippets, not compiled here
```

### 7.2 Pinned versions

- `templates/lock.json` is the only pin file. It pins the dicoogle-next commit, parent/SDK versions, Spring Boot, Java, dcm4che, and the web API version.
- Every template entry records its upstream source path and SHA-256.
- `node scripts/verify-templates.mjs` fails if a hash is stale or a placeholder is undeclared.
- The tool `version` command prints the tool version and the lock’s pinned values.

### 7.3 Template refresh procedure

1. Fetch dicoogle-next and check out the desired commit (default: the commit in `lock.json`).
2. Run `node scripts/refresh-templates.mjs --repo /path/to/dicoogle-next --commit <sha>`.
   - Reads only; writes only under the tool’s `templates/`.
   - Copies the files listed in the lock/source map and re-applies placeholder substitution.
   - Refuses to run if the source commit differs from `--commit`.
3. Review the diff by hand. Pay special attention to:
   - `PluginMetadata` shape (single `type` vs `List<String> types`),
   - `PluginRegistry` dedupe,
   - storage/query/listener interfaces and consumer signatures,
   - `plugin.config.json` schema and `apiVersion`,
   - `WebUIPlugin` getters and props,
   - POM dependency/version changes.
4. Update `lock.json` pins and hashes.
5. Run `node scripts/verify-templates.mjs`.
6. Run the full fixture matrix (§8) locally or in CI.
7. Commit the template refresh and lock update together, with a message naming the dicoogle-next commit.

The refresh script is developer-only and never runs in normal CLI use.

---

## 8. Verification plan

### 8.1 Tool-level tests

- `node --test` for parser, validation, naming, closure rules, renderer, composer, fs safety, exit codes.
- Snapshot tests for the exact file tree and selected file contents per family/hook.
- Negative tests: invalid id, invalid package, unknown flag, unknown hook, non-empty target, `--force`, `--dry-run` no writes, duplicate id with `--repo`, conflicting relative parent POM.
- `node scripts/verify-templates.mjs` in CI.

### 8.2 Java matrix

For each family and meaningful combination:

- storage: `--readable`, `--writable`, `--listable`, `--locator`, `--readable --writable`, `--writable --locator`, all flags.
- query-index: `--ingest`, `--query`, `--move`, `--maintenance`, `--settings`, all flags; plus a negative test that `--locator` exits `2`.
- listener: `--ingest` (assert `org.dicoogle.query.*`, `app.query.*`, type `query-index`, `*IngestListener`) and `--retrieve` (assert `org.dicoogle.service.*`, `app.service.*`, type `service`, `*RetrieveListener`).

CI procedure per case (automated by `scripts/build-fixtures.mjs`):

```bash
git clone <dicoogle-next> /tmp/dicoogle-next
git -C /tmp/dicoogle-next checkout <pinned sha>

# Install parent + SDK locally (needed for standalone and for non-reactor checks)
(cd /tmp/dicoogle-next/backend && ./mvnw -B -ntp -N install)
(cd /tmp/dicoogle-next/backend && ./mvnw -B -ntp -pl dicoogle-next-sdk -am install)

# Generate into the temp checkout
node bin/dicoogle-plugin-bootstrap.mjs java \
  --family storage --id ci-storage --readable --writable --listable --locator \
  --out /tmp/dicoogle-next/backend/plugins/dicoogle-next-storage-ci-storage

# CI-only harness edits the TEMP checkout (the tool never does)
# add <module>plugins/dicoogle-next-storage-ci-storage</module> to backend/pom.xml
# add the dependency to backend/dicoogle-next/pom.xml

# Formatting: check before any bound apply
(cd /tmp/dicoogle-next/backend && ./mvnw -B -ntp \
  -pl plugins/dicoogle-next-storage-ci-storage spotless:check)
(cd /tmp/dicoogle-next/backend && ./mvnw -B -ntp \
  -pl plugins/dicoogle-next-storage-ci-storage test)

# Prove no Spotless rewrite during the normal lifecycle
sha256sum /tmp/dicoogle-next/backend/plugins/dicoogle-next-storage-ci-storage/**/*.java > /tmp/before.sha
(cd /tmp/dicoogle-next/backend && ./mvnw -B -ntp \
  -pl plugins/dicoogle-next-storage-ci-storage validate)
sha256sum -c /tmp/before.sha
```

Also:

- Full reactor build after adding one generated module per family: `./mvnw -B -ntp clean verify`.
- Standalone build outside the checkout:

```bash
node bin/... java --family query-index --id standalone-index --ingest --query \
  --out /tmp/standalone/dicoogle-next-query-standalone-index
(cd /tmp/standalone/dicoogle-next-query-standalone-index && mvn -B -ntp spotless:check test)
```

Standalone mode requires the parent/SDK installed in step 2. The generated README states this.

### 8.3 Web matrix

For each of the seven hooks plus one multi-hook case:

```bash
git clone <dicoogle-next> /tmp/dicoogle-next
git -C /tmp/dicoogle-next checkout <pinned sha>

node bin/... web --id ci-hook --hooks query-filter \
  --out /tmp/dicoogle-next/webapp/src/plugins/ci-hook

(cd /tmp/dicoogle-next/webapp && npm ci)
(cd /tmp/dicoogle-next/webapp && npm run lint)
(cd /tmp/dicoogle-next/webapp && npm run type-check)
(cd /tmp/dicoogle-next/webapp && npm run build)
```

The multi-hook case uses `--hooks route,sidebar-menu,settings` and must pass the same checks. Because `webapp/src/plugins` is empty except `.gitkeep`, this exercises the plugin loader’s discovery path at `plugin-loader.ts:135-199` and `:350-353`.

### 8.4 CLI contract tests

- `--dry-run` output contains the expected tree and creates no files.
- Non-empty target exits `3`; with `--force` it writes and leaves unrelated files untouched.
- `--repo` with an existing metadata id exits `4`; web duplicate exits `4`.
- Invalid id exits `2` before any write.
- `--repo` pointing at a non-dicoogle-next directory exits `2`.
- `version` and `list` are stable and include the pinned commit.
- Node < 20 exits `7` (tested via a mocked `process.versions` guard or CI job).

### 8.5 CI jobs

1. `lint` / `test` for the tool (`node --test`).
2. `templates` — hash/placeholder verification.
3. `java-matrix` — generate, copy to temp checkout, check Spotless, test, standalone build.
4. `web-matrix` — generate, copy to temp checkout, npm ci/lint/type-check/build.
5. `cli-contract` — exit codes, dry-run, safety, duplicate scan.

Cache `~/.m2`, the dicoogle-next checkout, and webapp `node_modules`/npm cache. Pin the clone to the full SHA; do not track a branch.

---

## 9. Documentation plan

### 9.1 Tool README

- What the tool does and does not do (creates files only; no wiring; no dicoogle-next edits).
- Requirements: Node 20+, Java 21, Maven 3.9.12 for building generated modules.
- Install/run: `node bin/dicoogle-plugin-bootstrap.mjs ...` and optional `npm link`.
- Commands and flags with examples.
- Family/hook capability tables.
- Exit codes.
- Template pin and how to refresh.
- Safety behavior (`--force`, `--dry-run`, `--repo`).
- Known limitations and link to §10 risks.

### 9.2 Generated Java README

- Capabilities and generated file map.
- **The only YAML snippet**, e.g.:

```yaml
app:
  storage:
    my-dicom-store:
      enabled: true
      root-dir: ./data/my-dicom-store
      scheme: my-dicom-store
```

- Listener kind mapping when applicable: ingest uses `app.query.<id>`, retrieve uses `app.service.<id>`.
- Build and test commands.
- Manual wiring checklist.
- TODOs and extension points.
- dicoogle-next pin and SDK version.
- License note: no header by default; with `--license`, one `// SPDX-License-Identifier: ...` line is present.

### 9.3 Generated web README

- Hooks and generated files.
- `plugin.config.json` fields, including `apiVersion: "1.0"` and the single `type`.
- No `package.json`; host provides React/TypeScript/Vite and `@/plugin-system`.
- Dev workflow: copy to `webapp/src/plugins/<id>`, restart Vite, run lint/type-check/build.
- Manual wiring checklist.
- TODOs.
- dicoogle-next pin.

### 9.4 `WIRING.md`

One canonical document, referenced by generated READMEs:

- **Java:** copy module to `backend/plugins/<artifactId>`; add `<module>` to `backend/pom.xml`; add dependency to `backend/dicoogle-next/pom.xml`; add YAML to `application.yml` or a profile; rebuild.
- **Web:** copy folder to `webapp/src/plugins/<id>`; restart Vite (new directories are not watched, per `plugin-loader.ts:350-353`); run `npm run lint`, `npm run type-check`, `npm run build`.
- **Uninstall:** reverse the steps.
- **Explicit warning:** the tool never edits these files; all changes are manual and reviewable.

No generated docs modify dicoogle-next’s own documentation.

---

## 10. Risks and contradictions

| ID | Risk / contradiction | Impact | Mitigation |
|---|---|---|---|
| R1 | `apiVersion` confusion: loader supports `1`/`1.0` (`plugin-loader.ts:35`), registry state is `1.1` (`registry.ts:15`), docs use `1.0` (`plugin-system-docs.md:69`, `:1012`). | Generated descriptor could be wrong or warned. | Emit `1.0` only; document that `registry.ts` `CURRENT_VERSION` is unrelated. Add `--api-version` restricted to `1`/`1.0`. |
| R2 | Spotless `apply` at `validate` mutates sources (`backend/pom.xml:103-111`). | Noisy diffs; generated output may be rewritten. | Pre-format templates; `spotless:check` in CI; hash check before/after lifecycle. |
| R3 | HEAD `PluginRegistry` has no dedupe (`PluginRegistry.java:13-15`); storage plugins implementing `QueryIndexStorageLocator` can register twice. | Duplicate plugin entries. | Storage `--locator` uses `DicomInstanceLocator` only; document; issue-58 fixes this later. |
| R4 | `PluginMetadata.type` is a single string with drift: backend uses `query-index`, UI expects `index`/`query`/`storage` (`PluginSettings.tsx:14`, `:129-152`). | Query/index plugins may not appear in the expected management tab. | One `{{pluginType}}` variable; default to bundled `query-index`; `--type` override; document drift; prepare for `List<String> types`. |
| R5 | Issue-58 (`fix/issue-58-plugin-registration`, `e62ba3e`) is unmerged and changes `type` to `List<String> types` plus dedupe. | Future template refresh changes metadata shape. | Pin to HEAD `cdfbff7`; keep type in one variable; refresh procedure explicitly checks this. |
| R6 | Pure query-index `QueryIndexStorageLocator` is not injected into `List<DicomInstanceLocator>` on HEAD; only storage plugins are (`PluginRuntimeConfig.java:84-90`). | A query-index `--locator` plugin would compile but not be used. | D1: `--locator` on query-index exits `2`; only storage locator is generated; document the SDK/implementation mismatch; revisit if a future branch fixes it. |
| R7 | `QueryIndexSettings` is not a `QueryIndexPlugin`; the controller takes `findFirst()` (`IndexSettingsController.java:25-31`). | Settings-only or multiple settings plugins may be ignored/ambiguous. | `--settings` adds `QueryIndexPlugin`; document single-settings assumption; warn in README. |
| R8 | Retrieve listener fires only for DICOMweb retrieval; ingest listener only for DIMSE C-STORE. | Developer expectations may not match actual events. | State the exact scope in the generated README and in the CLI family help. D13 also makes the two listener kinds visibly different in package, artifact, prefix, and metadata type. |
| R9 | `ServicePlugin` and `MlProviderPlugin` have no direct consumers. | Generating them produces dead code. | Exclude both families. `--retrieve` remains because its subinterface is consumed. |
| R10 | Parent POM `relativePath` cannot satisfy both reactor and arbitrary-path builds with a single hard-coded path without checks. | Wrong parent or non-resolvable parent. | Always emit `../../pom.xml`; validate the target; if absent, fall back to installed parent; if wrong GAV, exit `2`. |
| R11 | SDK/parent are local-only as verified; no `distributionManagement`. | Standalone builds fail on a clean machine. | Document `mvn install` of parent + SDK; CI installs them; mark remote publication UNVERIFIED. |
| R12 | The Java module version is inherited (`0.0.1-SNAPSHOT`), while `PluginMetadata.version` is the plugin’s own version. | Confusion between Maven and plugin versions. | Document two versions: Maven inherits parent; metadata uses `--plugin-version` (default `0.1.0`). |
| R13 | No license headers exist in dicoogle-next, but the repo is GPLv3 (`license.md:1-2`). | Legal ambiguity for generated files. | Default no header (matches repo); `--license <SPDX>` emits only one `// SPDX-License-Identifier: ...` line; document that legal review is the user’s responsibility. |
| R14 | Web `type` is not validated; multi-hook plugins have no canonical type. | Inconsistent taxonomy. | Single `{{pluginType}}`, default hook token or `multi`, `--type` override. |
| R15 | New web plugin directories require a Vite restart; no watch for new dirs. | Developer confusion during dev. | State it in generated README and `WIRING.md`. |
| R16 | Web examples are not built and `webapp/src/plugins` is empty. | Templates are derived from documentation examples, not a live plugin. | CI copies generated output into a real temp checkout and runs lint/type-check/build. |
| R17 | Docs drift: `WebUIPlugin` snippets omit getter args; docs use `dicoogleService` directly; `apiVersion` mismatch. | Generated code copied from docs could fail. | Derive from `types.ts` and `plugin-loader.ts`, not prose docs; document drift. |
| R18 | `--repo` id scan is regex-based. | False positives/negatives. | Scan only `src/main` Java and live web plugin configs; generated `PluginMetadata` uses a literal; document heuristic. |
| R19 | Java package normalization strips hyphens, so `foo-bar` and `foobar` share a default package. | Split package; class/bean names remain distinct and both modules can coexist, verified by the collision probe. | Warn on normalization collision; allow `--package` override. |
| R20 | Generated storage default scheme could collide with `file` and alter routing. | Unexpected storage behavior. | Default scheme = id; storage templates default `enabled=false`; document YAML. |
| R21 | JUnit is resolved as 6.0.3, not 5.x. | Dependency confusion if a version is pinned. | Use Jupiter API, no version; parent BOM manages. |
| R22 | The tool’s zero-dependency constraint means no schema/arg library. | More custom code to test. | Keep parser/renderer small, typed, and unit-tested; no reason to abandon zero dependencies. |

---

## 11. Ordered implementation milestones

Each milestone is independently testable.

1. **Repository skeleton + CLI contract.**
   - `package.json`, `bin`, `src/cli.mjs`, `src/args.mjs`, `src/errors.mjs`.
   - `--help`, `version`, `list`, unknown-command handling, exit codes.
   - Test: `node --test test/cli.test.mjs`; `node bin/... version`.

2. **Validation and naming.**
   - `src/validate.mjs`, `src/naming.mjs`.
   - ID/name/package/scheme/version rules and conversion table.
   - Test: valid/invalid cases, reserved words, normalization collision warning.

3. **Template lock + verify tooling.**
   - `templates/lock.json` schema, `src/lock.mjs`, `scripts/verify-templates.mjs`.
   - Hash/placeholder checks, pinned commit/version output.
   - Test: mutate a hash → exit `5`.

4. **Render engine + Java model/plan for storage.**
   - `src/render.mjs`, `src/model.mjs`, `src/plan.mjs`, `src/java/compose.mjs`.
   - Storage capability closure and file plan.
   - Test: snapshot for readable/writable/listable/locator/all; `--dry-run` tree.

5. **Java storage templates + compile fixture.**
   - POM, class, config, properties, test, README.
   - Test: generate into a temp dicoogle-next checkout; `spotless:check`, `mvn test`.
   - Include readable-only and all-capabilities cases.

6. **Java query-index model/templates + compile fixture.**
   - Ingest/query/move/maintenance/settings fragments; settings-marker rule.
   - Test: each capability and all-capabilities build/test.

7. **Listener family templates + compile fixture.**
   - Ingest listener (`query` domain, `app.query`, type `query-index`, `IngestListener`) and retrieve listener (`service` domain, `app.service`, type `service`, `RetrieveListener`).
   - DIMSE remains descoped: no policy or association-listener generation.
   - Test: each listener kind builds/tests; kind mapping is asserted in generated POM/package/config/metadata; event scope references are checked.

8. **Parent POM strategy + standalone/in-repo harness.**
   - POM templates, relativePath validation, dependency matrix.
   - Test: in-reactor build and standalone build against installed parent/SDK; conflicting `../../pom.xml` exits `2`.

9. **Web model/templates for all hooks + multi-hook.**
   - `plugin.config.json`, `index.ts`, components, README.
   - Test: each hook and multi-hook copied into a temp webapp; `npm run lint`, `type-check`, `build`.

10. **Safety and repo scanning.**
    - Non-empty/`--force`, dry-run no writes, `--repo` validation and duplicate scan, `--license` one-line SPDX, query-index `--locator` rejection.
    - Test: exit codes `2/3/4`, no partial writes on failure, exactly one SPDX line when requested.

11. **Documentation.**
    - Tool README, `WIRING.md`, generated Java/Web READMEs, `list`/help text.
    - Test: docs contain the pinned commit and no stale command/flags; link check.

12. **CI matrix + refresh workflow.**
    - `scripts/build-fixtures.mjs`, CI jobs, template refresh script.
    - Test: full local matrix; a deliberate stale template fails CI.

---

## Remaining open questions

The original 12 questions are resolved and locked in §0.2. Only minor implementation-level confirmations remain; none block milestone 1.

1. **SPDX validation strictness:** accept any non-empty SPDX-like token (current) or validate `--license` against a bundled SPDX allowlist?
2. **Web stub styling:** generated components use minimal Tailwind classes consistent with the examples (current); should they instead be unstyled to reduce host-styling coupling?

---

## Addendum A — Listener identity (D13)

This addendum records the milestone-2 implementation choice for the listener
family. The two kinds are deliberately different plugin identities because the
code registers and consumes them differently.

| Listener kind | Extension base | Registered in `PluginRegistry` | Consumed by | Domain | Package | ArtifactId | Config prefix | Metadata type | Class suffix |
|---|---|---|---|---|---|---|---|---|---|
| `--ingest` | `StorageIngestEventListener extends QueryIndexPlugin` | Yes, via `List<QueryIndexPlugin>` (`PluginRuntimeConfig.java:70-77`) | `CStoreService` (`CStoreService.java:35-70`, `:364`, `:382`) | `query` | `org.dicoogle.query.<id-without-hyphens>` | `dicoogle-next-query-<id>` | `app.query.<id>` | `query-index` | `IngestListener` |
| `--retrieve` | `StorageRetrieveEventListener extends ServicePlugin` | No | `DicomwebRetrieveService` (`DicomwebRetrieveService.java:43`, `:48-56`, `:369`, `:382`) | `service` | `org.dicoogle.service.<id-without-hyphens>` | `dicoogle-next-service-<id>` | `app.service.<id>` | `service` | `RetrieveListener` |

Implementation notes:

- `src/naming.mjs` exposes `LISTENER_IDENTITIES` and `deriveJavaIdentity()` so
  the mapping cannot drift between code and docs.
- Generated listener READMEs must use the kind-specific YAML prefix:
  `app.query.<id>` for ingest, `app.service.<id>` for retrieve.
- The generated metadata type remains a single string in `{{pluginType}}`.
- The event scope is unchanged: ingest is DIMSE C-STORE only (`CStoreService.java:364`,
  `CStoreService.java:382`); retrieve is DICOMweb retrieval only
  (`DicomwebRetrieveService.java:369`, `DicomwebRetrieveService.java:382`).
- Generated listener READMEs repeat those exact file:line references.
- `templates/lock.json` records the same mapping under `listenerIdentities`.
  The lock verifier cross-checks domain, package template, artifactId template,
  config prefix template, metadata type, and class suffix against
  `src/naming.mjs`. The lock is the pinned data source; naming.mjs is the
  executable contract.

---

## Addendum B — Query-index follow-up evidence (milestone 6)

### Long-id matrix case

The canonical plugin id is limited to 64 characters (§5.1), and the query-index
class suffix is `QueryIndexPlugin` (16 characters). A generated Java **simple
class name** therefore cannot exceed 80 characters. The literal requirement
“class name exceeds 100 columns” is impossible under the current id rule.

The fixture matrix therefore uses
`fixture-query-index-long-ident` (30 characters, generated class name
`FixtureQueryIndexLongIdentQueryIndexPlugin`). It is long enough to force
Google-Java-Format line wrapping in the class declaration, constructor, context
tests, and configuration. It is a permanent case in
`scripts/build-fixtures.mjs` and passes `spotless:check`, generated tests, and
the no-rewrite hash check.

### Settings displacement warning

`--settings` emits a warning in the generated README, `--help`, and CLI stderr:

> `IndexSettingsController` selects the FIRST `QueryIndexSettings` provider
> (`IndexSettingsController.java:25-31`). Currently Lucene wins because
> `LuceneQueryConfig` has `@Order(0)` (`LuceneQueryConfig.java:16`), but bean
> ordering is not a stable contract. If a generated provider is enabled, only
> the first provider is exposed and mutated; keep at most one enabled.

The warning reflects observed behavior. In a temp checkout at the pinned
commit with the all-flags query-index module wired next to Lucene, a focused
probe test observed Lucene as the selected provider in three consecutive runs
(`org.dicoogle.query.lucene.LuceneQueryIndexPlugin`, index path
`./target/test-index`). Lucene's `@Order(0)` currently wins list ordering, but
ordering is not a stable contract, so the warning remains necessary.

### Registry and routing evidence

Probe results in the temp app (filtered to fixture ids):

| Case | `PluginRegistry` | `QueryRouter` query list | `QueryRouter` move list | Ingest listener list | Selected settings provider |
|---|---|---|---|---|---|
| `--ingest` only | `fixture-ing` | empty | empty | `fixture-ing` | Lucene |
| `--query` only | `fixture-qry` | `fixture-qry` | empty | empty | Lucene |
| all flags | `fixture-qall` | `fixture-qall` | `fixture-qall` | `fixture-qall` | Lucene |

The plugin is registered wherever the code consumes the corresponding list. It
is not present in lists for capabilities it does not implement.

### Lifecycle evidence

Generated query-index tests use `ApplicationContextRunner` with the generated
config. They assert `startCount() == 1` after context refresh and
`stopCount() == 1` after context close, proving `@Bean(initMethod="start",
destroyMethod="stop")` is wired exactly once.

---

## Addendum C — Listener family evidence (milestone 7)

The listener family is implemented; DIMSE is descoped.

### Generated listener cases

`scripts/build-fixtures.mjs` now includes:

- `--ingest` and `--retrieve`
- `ingest-long` and `retrieve-long` variants
- `spotless:check`, generated tests, and no-rewrite hash checks for every case
- full reactor with both listener kinds wired as app dependencies
- standalone ingest and retrieve builds

Observed matrix results:

```text
=== listener case: ingest ===
case ingest: spotless:check + tests OK, no rewrite
=== listener case: retrieve ===
case retrieve: spotless:check + tests OK, no rewrite
=== listener case: ingest-long ===
case ingest-long: spotless:check + tests OK, no rewrite
=== listener case: retrieve-long ===
case retrieve-long: spotless:check + tests OK, no rewrite
```

Each generated listener test class runs 5 tests: metadata, enabled-context
registration, disabled-context absence, callback recording, and consumed-list
visibility.

### Event scope verification

- Ingest: `StorageIngestEventListener` is injected into `CStoreService`
  (`CStoreService.java:35-70`) and dispatched at
  `CStoreService.java:364` and `CStoreService.java:382`. A repository-wide search
  found no DICOMweb STOW dispatch.
- Retrieve: `StorageRetrieveEventListener` is injected into
  `DicomwebRetrieveService` (`DicomwebRetrieveService.java:43-56`) and
  dispatched at `DicomwebRetrieveService.java:369` and
  `DicomwebRetrieveService.java:382`. A repository-wide search found no DIMSE
  C-MOVE dispatch.

Generated listener READMEs include those exact references and state the negative
scope explicitly.

### App-context list evidence

Temp checkout with the listener ingest/retrieve modules wired:

```text
PROBE_INGEST_LISTENERS=[fixture-qall, fixture-lst-ing]
PROBE_RETRIEVE_LISTENERS=[fixture-lst-ret]
```

`fixture-qall` is the all-flags query-index fixture, which also implements
`StorageIngestEventListener`; the dedicated listener module is
`fixture-lst-ing`. The retrieve listener appears only in the retrieve list.

---

## Addendum D — Bean-name audit and collision evidence (milestone 7 follow-up)

### Bean method audit

Spring's default bean name is the `@Bean` method name (none of the generated
templates declare an explicit `name`). All generated families now derive the
method name from the generated class name in lowerCamelCase.

| Family | Config template | Old generic method | New method / Spring bean name | Example |
|---|---|---|---|---|
| storage | `templates/java/storage/config.java.tmpl` | `storagePlugin` | `<classLowerCamel>` | `MyDicomStoreStoragePlugin` -> `myDicomStoreStoragePlugin` |
| query-index | `templates/java/query-index/config.java.tmpl` | `queryIndexPlugin` | `<classLowerCamel>` | `MyIndexQueryIndexPlugin` -> `myIndexQueryIndexPlugin` |
| listener ingest | `templates/java/listener/config.java.tmpl` | `ingestListener` | `<classLowerCamel>` | `MyAuditIngestListener` -> `myAuditIngestListener` |
| listener retrieve | `templates/java/listener/config.java.tmpl` | `retrieveListener` | `<classLowerCamel>` | `MyAuditRetrieveListener` -> `myAuditRetrieveListener` |

The previous risk that two same-kind listener modules could not coexist is
removed. Distinct plugin ids produce distinct class names and therefore distinct
bean names.

### Collision fixture case

`scripts/build-fixtures.mjs` now includes a permanent collision case that
generates and wires:

- two storage modules with different schemes
- two storage modules with ids `foo-bar` and `foobar` that share the package
  `org.dicoogle.storage.foobar`
- two all-flags query-index modules
- two ingest listeners
- two retrieve listeners

All ten modules are added to the temp app and built in the full reactor. A
generated `BeanCollisionProbeTest` starts the app context with the collision
modules explicitly enabled and asserts the consumed lists contain them. Lucene is disabled
only for that probe context to avoid its JVM-level write-lock conflict between
multiple cached test contexts.

For `foo-bar` and `foobar`, the class names are `FooBarStoragePlugin` and
`FoobarStoragePlugin`, and the bean method names are `fooBarStoragePlugin` and
`foobarStoragePlugin`. Only the package segment collides; the generated classes
and beans are distinct and the shared-package pair starts in the same context.
This corrects an earlier report claim that the class names were identical.

Observed collision probe output:

```text
COLLISION_STORAGE=[storage-file-ro, collision-st-a, collision-st-b, foo-bar, foobar]
SAME_PACKAGE_STORAGE=[storage-file-ro, collision-st-a, collision-st-b, foo-bar, foobar]
COLLISION_QUERY=[collision-q-a, query-file-rw, collision-q-b]
COLLISION_MOVE=[collision-q-a, query-file-rw, collision-q-b]
COLLISION_INGEST=[query-file-rw, collision-q-a, collision-q-b, collision-ing-a, collision-ing-b]
COLLISION_RETRIEVE=[collision-ret-a, collision-ret-b]
```

The app context started without `BeanDefinitionOverrideException`, and the full
reactor with all ten modules passed.

### Faster fixture runs

`scripts/build-fixtures.mjs` now supports:

- `--only <case[,case]>` to run selected cases; `--only collision` expands to
  the ten collision cases
- `--skip-standalone` to skip standalone builds
- `--skip-full-reactor` to skip the reactor build

A fast collision-only verification is:

```bash
node scripts/build-fixtures.mjs --repo /path/to/dicoogle-next \
  --only collision --skip-standalone
```


---

## Addendum E — Stub safety and opt-in defaults (routing-findings follow-up)

The routing investigation (`query-routing-findings.md`) showed that a
previously default-enabled generated query-index provider joins every C-FIND/C-MOVE query
when `app.dimse.dim-providers` is empty or QIDO-RS has no `provider` parameter.
The generated stubs ignored request keys and returned recorded entries, so a
client could receive unrelated results. Generated listeners also ran inside
`listeners.forEach` loops with no exception isolation.

Reversal and mitigations:

- Query-index and listener now default to `enabled=false` /
  `matchIfMissing=false`, matching storage. Generated READMEs state "set
  `enabled: true` to activate".
- Generated `query()` and `resolve()` return an empty list with a TODO that
  names the request fields to match. They never return recorded ingest entries.
- Ingest entries remain in an in-memory map for tests/future logic, exposed only
  through package-private accessors. Maintenance uses a separate path set and
  only updates its own counts; it never feeds query/move.
- Ingest and retrieve callbacks catch/log `RuntimeException` and never rethrow.
  `CStoreService.java:364`/`:382` has no per-listener isolation; a throwing
  listener aborts later listeners and a success exception can turn a successful
  store into a failure (`CStoreService.java:233-248`).
- Generated READMEs document routing fan-out, dedup keys, missing router
  timeouts, unstable provider order, settings first-provider selection, and
  maintenance all-provider mutation.
- `templates/lock.json` carries `reservedPluginIds`; generation rejects bundled
  ids such as `lucene` with exit `2`, because duplicate provider ids silently
  overwrite in `QueryRouter.java:202-210`.
- The fixture harness now wires every selected generated module into the temp
  app; opt-in defaults keep them inactive. The collision probe explicitly sets
  `enabled=true` for all collision modules.

Verification on the pinned commit: a generated `routing-probe` module with
`--ingest --query --move` was wired next to Lucene. With no enable property, the
plugin registry was `[lucene, storage-file-ro, storage-file-rw]`; non-matching
query/move results were empty. With `app.query.routing-probe.enabled=true`, the
registry added `routing-probe`, but non-matching query/move results remained
empty and matching results were identical to Lucene-only results.
