# Milestone 6 Follow-up Report — Query-Index Family

- **Branch:** `feat/m06-query-index`
- **Push:** none
- **Original `dicoogle-next` checkout:** zero tracked changes
- **Temp probe checkout:** removed after evidence capture

## Commits

```text
5290cbc docs: record query-index follow-up evidence
8026cd6 test: cover query-index lifecycle, settings warning, and long-id wrapping
6710d6d feat: add query-index long-id case, lifecycle checks, and settings warning
```

## Files changed

- `src/cli.mjs` — `--help` and stderr settings warning.
- `src/java/fragments/query-index/base.mjs` — lifecycle counters/tests and long-id-safe context tests.
- `src/java/compose.mjs` — argument/top-level wrapping for long identifiers.
- `templates/java/query-index/README.md.tmpl` — generated settings warning.
- `templates/lock.json` — updated README hash.
- `scripts/build-fixtures.mjs` — permanent `long-id` query-index matrix case.
- `test/{cli,query-index-model,query-index-plan,helpers}.mjs` and `test/fixtures/query-index/*` — new coverage/snapshots.
- `docs/design.md` — Addendum B evidence.
- `README.md` — settings/lifecycle notes.

## Item 1 — long-id matrix case

Literal requirement cannot hold: plugin ids are capped at 64 characters and the query-index suffix is `QueryIndexPlugin` (16), so a **simple Java class name cannot exceed 80 characters**. A 30-character id, `fixture-query-index-long-ident`, was used instead; it forces wrapping in the class declaration, constructor, config, and context tests.

Permanent matrix result:

```text
=== query-index case: long-id ===
case long-id: spotless:check + tests OK, no rewrite
FixtureQueryIndexLongIdentQueryIndexPluginTest
Tests run: 14, Failures: 0, Errors: 0
```

Full matrix still passes:

```text
All storage and query-index fixture cases, full reactor, and standalone builds passed.
```

## Item 2 — settings warning

Generated README:

```text
> **Warning:** `--settings` adds a `QueryIndexSettings` provider.
> `IndexSettingsController` selects the **first** provider
> (`IndexSettingsController.java:25-31`), so a default-enabled generated plugin
> can displace Lucene's provider once wired. Set `enabled=false` for one of them
> or disable the other.
```

CLI help:

```text
query-index: --ingest --query --move --maintenance --settings
             warning: IndexSettingsController selects the FIRST QueryIndexSettings
             provider (IndexSettingsController.java:25-31); set enabled=false or
             disable the other provider to avoid displacement.
```

CLI output when `--settings` is used:

```text
warning: --settings adds a QueryIndexSettings provider; IndexSettingsController selects the FIRST provider (IndexSettingsController.java:25-31), so a default-enabled generated plugin can displace Lucene's provider once wired. Set enabled=false or disable the other provider.
exit=0
```

## Item 3 — settings displacement evidence

Temp checkout at the pinned commit, all-flags module wired next to Lucene, focused `@SpringBootTest` probe using reflection:

```text
PROBE_REGISTRY=[fixture-qall]
PROBE_QUERY_ROUTER=[fixture-qall]
PROBE_MOVE_ROUTER=[fixture-qall]
PROBE_INGEST_LISTENERS=[fixture-qall]
PROBE_SETTINGS_PROVIDER=org.dicoogle.query.lucene.LuceneQueryIndexPlugin
PROBE_SETTINGS_PATH=./target/test-index
```

Three consecutive runs selected Lucene each time. Lucene's config carries `@Order(0)` (`LuceneQueryConfig.java:16`), so it currently wins list ordering.

**Conclusion:** the warning is conservative but valid; bean ordering is not a stable contract and other provider sets/orders could displace Lucene. Documented in `docs/design.md` Addendum B.

## Item 4 — lifecycle test

Generated test contains:

```java
@Test
void lifecycleRunsOnce() throws Exception {
  contextRunner
      .withPropertyValues("app.query.my-index.enabled=true")
      .run(
          context -> {
            MyIndexQueryIndexPlugin plugin = context.getBean(MyIndexQueryIndexPlugin.class);
            assertEquals(1, plugin.startCount());
            context.close();
            assertEquals(1, plugin.stopCount());
          });
}
```

The all-flags module now runs 14 tests, all passing. This proves `@Bean(initMethod="start", destroyMethod="stop")` invokes each exactly once.

## Item 5 — registry and routing evidence

| Case | `PluginRegistry` | QueryRouter query list | QueryRouter move list | Ingest listener list |
|---|---|---|---|---|
| `--ingest` only | `fixture-ing` | empty | empty | `fixture-ing` |
| `--query` only | `fixture-qry` | `fixture-qry` | empty | empty |
| all flags | `fixture-qall` | `fixture-qall` | `fixture-qall` | `fixture-qall` |

No unexpected omissions. Each capability appears exactly where the app consumes it; absent capabilities are absent from those lists.

## Deviations

- **Long-id literal:** class name >100 columns is impossible with the 64-character id cap; the case uses a 30-character id that exercises the same long-line wrapping.
- **Warning vs observed result:** warning says a generated plugin can displace Lucene; observed baseline consistently selects Lucene due `@Order(0)`. Warning retained as conservative guidance.
- **Probe test:** temp-only, not committed; results recorded in Addendum B.
- **Fixture app wiring:** full reactor still wires only all-flags storage/query modules as app dependencies to avoid multiple default-enabled query-index beans.

## Risks

- Settings selection depends on bean ordering; future `@Order` changes or different providers can flip it.
- Long-id coverage is capped by the id rule, not a true >100-character class name.
- Probe evidence relies on reflection over private fields (`queryServices`, `moveServices`, `listeners`, `indexSettings`), which may change.
- Query/move stubs remain simple in-memory scans; settings warning is documentation/CLI-level, not automatic ordering protection.
