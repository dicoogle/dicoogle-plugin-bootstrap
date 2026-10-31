# Milestone 9 report — web templates and multi-hook

Branch: `feat/m09-web-templates`  
Base: `97e0a55` (`main`, including the routing-safety fix)  
Reference: `dicoogle-next` at `cdfbff7f601d663453b9b7b77d6d3dc70af1b822`

## Files created/changed

Commits:

```text
ae6b238 docs: document web generation and verification
f8dc344 test: cover web hooks and multi-hook composition
849fec0 feat: add web plugin templates
77cab42 feat: add web hook model and composer
```

Created:

- `src/web/compose.mjs`
- `src/web/fragments/index.mjs`
- `templates/web/plugin.config.json.tmpl`
- `templates/web/README.md.tmpl`
- `templates/web/query-filter.tsx.tmpl`
- `templates/web/result-renderer.tsx.tmpl`
- `templates/web/route.tsx.tmpl`
- `templates/web/settings.tsx.tmpl`
- `test/web-model.test.mjs`
- `test/web-plan.test.mjs`

Changed:

- `src/model.mjs`: added `buildWebModel`.
- `src/plan.mjs`: added `buildWebData`, `buildWebPlan`, web plan validation, and `web-entry` materialization.
- `src/cli.mjs`: implemented `web` generation, dry-run, safe writes, and reserved-id checks.
- `templates/lock.json`: added six web templates; now 18 templates.
- `test/helpers.mjs`, `test/cli.test.mjs`, `test/render.test.mjs`.
- `README.md`.
- `docs/design.md`: Addendum F.

## Commands run with results

Tool tests:

```text
npm test
# tests 160
# pass 160
# fail 0
```

Template verification:

```text
npm run verify:templates
template lock OK: cdfbff7f601d663453b9b7b77d6d3dc70af1b822
reserved plugin ids: lucene, query-file-rw, storage-file-ro, storage-file-rw
templates verified: 18
```

Syntax checks:

```text
node --check: 35 files OK
```

Web verification in a temp clone at `cdfbff7f601d663453b9b7b77d6d3dc70af1b822`:

```text
npm ci: exit=0
```

Each case was generated into `webapp/src/plugins/<id>`, then checked separately:

| Hooks | Id | Generated files | Lint | Type-check | Build |
|---|---|---|---|---|---|
| `query-filter` | `date-range` | `index.ts`, `README.md`, `plugin.config.json`, `DateRangeFilter.tsx` | OK | OK | OK |
| `result-options` | `download-study` | `index.ts`, `README.md`, `plugin.config.json` | OK | OK | OK |
| `result-batch` | `download-batch` | `index.ts`, `README.md`, `plugin.config.json` | OK | OK | OK |
| `result-renderer` | `gallery` | `index.ts`, `README.md`, `plugin.config.json`, `GalleryRenderer.tsx` | OK | OK | OK |
| `sidebar-menu` | `shortcuts` | `index.ts`, `README.md`, `plugin.config.json` | OK | OK | OK |
| `route` | `reports` | `index.ts`, `README.md`, `plugin.config.json`, `ReportsPage.tsx` | OK | OK | OK |
| `settings` | `my-settings` | `index.ts`, `README.md`, `plugin.config.json`, `MySettingsSettings.tsx` | OK | OK | OK |
| `route,sidebar-menu,settings` | `study-tools` | `index.ts`, `README.md`, `plugin.config.json`, `StudyToolsPage.tsx`, `StudyToolsSettings.tsx` | OK | OK | OK |

Example Vite virtual-module output:

```text
✓ Plugin Loader: Discovered 1 plugin(s)
  - date-range v0.1.0 (date-range) [enabled-by-default]

import Plugin0 from '.../webapp/src/plugins/date-range/index.ts';
pluginRegistry.registerPlugin(Plugin0, {"id":"date-range","apiVersion":"1.0",...,"type":"query-filter"}, true);
{ id: 'date-range', name: 'date-range', directory: 'date-range', entry: 'index.ts', defaultEnabled: true }
```

All eight cases imported their generated `index.ts` into the virtual module and
registered the expected id/type. Multi-hook registered `type: "multi"`.

Original `dicoogle-next` tracked state:

```text
git -C ... diff --stat
(no output)
```

Untracked files remain present but were not created or modified. Temp clone
removed. No push.

## Deviations from the design

- Web tests assert exact file trees and key content, but do not use golden-file snapshot files.
- Generated components are intentionally minimal functional stubs (checkbox/text pages), not full example UIs.
- `result-options` and `result-batch` actions only log and show a toast.
- `--repo` Java/web id scanning remains unimplemented; that belongs to the safety/repo-scan milestone.
- `init` remains a stub as specified.
- `--license` is not emitted into web plugin files; the design’s web config schema does not include it.

## Risks

- `sidebar-menu` alone points to `/plugins/<id>` without a generated route; users should combine it with `route` or provide their own route.
- Generated web hooks do not implement real search/download/settings behavior yet.
- Web `type` remains a free-form string except for validation; multi-hook uses `multi`.
- New plugin folders require a Vite restart.
- Verification covered the pinned webapp and current Node/npm environment only; no browser interaction was tested.
- No golden snapshots means broad rendering changes could pass structural tests; the real webapp build checks mitigate this.

## Suggested next milestone

Implement milestone 10’s safety and repository scanning: `--repo` validation,
Java/web id collision detection with exit `4`, cross-namespace warning behavior,
and tests for no partial writes on failure. The web generator is now ready to be
included in that scan because `plugin.config.json` carries the canonical web id
and the generated virtual module registration is verified.
