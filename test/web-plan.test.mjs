import assert from "node:assert/strict";
import test from "node:test";

import { loadLock } from "../src/lock.mjs";
import { buildWebPlan, materializePlan } from "../src/plan.mjs";
import { WEB_HOOK_CASES, webModel } from "./helpers.mjs";

const HOOK_METHODS = {
  "query-filter": "getQueryFilterExtensions",
  "result-options": "getResultOptionsExtensions",
  "result-batch": "getResultBatchExtensions",
  "result-renderer": "getResultRendererExtensions",
  "sidebar-menu": "getSidebarMenuExtensions",
  route: "getRouteExtensions",
  settings: "getSettingsExtensions",
};

test("every web hook produces a valid plan", () => {
  const lock = loadLock();

  for (const [hook, suffix] of WEB_HOOK_CASES) {
    const model = webModel([hook]);
    const plan = buildWebPlan(model, lock);
    const files = materializePlan(plan);
    const paths = files.map((file) => file.path);
    const index = files.find((file) => file.path === "index.ts");
    const config = files.find(
      (file) => file.path === "plugin.config.json",
    );
    const readme = files.find((file) => file.path === "README.md");

    assert.ok(paths.includes("plugin.config.json"), hook);
    assert.ok(paths.includes("README.md"), hook);
    assert.ok(paths.includes("index.ts"), hook);
    assert.ok(!paths.includes("package.json"), hook);

    if (suffix) {
      assert.ok(paths.includes(`MyWeb${suffix}.tsx`), hook);
    }

    assert.ok(index, hook);
    assert.doesNotMatch(index.content, /\{\{/, hook);
    assert.doesNotMatch(index.content, /<[A-Z]/, hook);
    assert.match(index.content, new RegExp(HOOK_METHODS[hook]), hook);
    assert.match(index.content, /import \{ WebUIPlugin/, hook);

    assert.ok(config, hook);
    const parsed = JSON.parse(config.content);
    assert.equal(parsed.id, "my-web", hook);
    assert.equal(parsed.entry, "index.ts", hook);
    assert.equal(parsed.apiVersion, "1.0", hook);
    assert.equal(parsed.enabled, true, hook);
    assert.equal(parsed.type, hook, hook);
    assert.equal(parsed.name, "My Web", hook);
    assert.equal(parsed.version, "0.1.0", hook);
    assert.equal(parsed.description, "Demo web plugin", hook);
    assert.equal(parsed.author, "Team", hook);

    assert.ok(readme, hook);
    assert.match(readme.content, /No `package.json` is generated/, hook);
    assert.match(readme.content, /webapp\/src\/plugins\/my-web/, hook);
    assert.match(readme.content, /Restart Vite/, hook);
  }
});

test("multi-hook composes methods without duplicate React imports", () => {
  const lock = loadLock();
  const model = webModel(["route", "sidebar-menu", "settings"]);
  const files = materializePlan(buildWebPlan(model, lock));
  const index = files.find((file) => file.path === "index.ts");
  const config = files.find((file) => file.path === "plugin.config.json");

  assert.ok(index);
  assert.match(index.content, /getRouteExtensions/);
  assert.match(index.content, /getSidebarMenuExtensions/);
  assert.match(index.content, /getSettingsExtensions/);
  assert.match(
    index.content,
    /import \{ createElement, lazy \} from "react";/,
  );
  assert.equal(
    (index.content.match(/from "react"/g) ?? []).length,
    1,
  );
  assert.equal(
    (index.content.match(/const MyWebPage = lazy/g) ?? []).length,
    1,
  );
  assert.equal(
    (index.content.match(/const MyWebSettings = lazy/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(index.content, /metadata:/);

  assert.ok(config);
  assert.equal(JSON.parse(config.content).type, "multi");
});

test("web component templates use the exact prop types", () => {
  const lock = loadLock();
  const queryFiles = materializePlan(
    buildWebPlan(webModel(["query-filter"]), lock),
  );
  const rendererFiles = materializePlan(
    buildWebPlan(webModel(["result-renderer"]), lock),
  );

  const filter = queryFiles.find(
    (file) => file.path === "MyWebFilter.tsx",
  );
  const renderer = rendererFiles.find(
    (file) => file.path === "MyWebRenderer.tsx",
  );

  assert.ok(filter);
  assert.match(filter.content, /QueryFilterProps/);
  assert.match(filter.content, /onChange/);
  assert.match(filter.content, /context\.logger\.info/);

  assert.ok(renderer);
  assert.match(renderer.content, /ResultRendererProps/);
  assert.match(renderer.content, /onResultSelect/);
});

test("web plan rejects a missing entry file", () => {
  const lock = loadLock();
  const plan = buildWebPlan(webModel(["route"]), lock);
  plan.files = plan.files.filter((file) => file.path !== "index.ts");

  assert.throws(
    () => materializePlan(plan),
    /web entry file is missing/,
  );
});


test("component suffixes are not doubled", () => {
  const cases = [
    ["query-filter", "my-filter", "MyFilter.tsx"],
    ["result-renderer", "my-renderer", "MyRenderer.tsx"],
    ["route", "my-page", "MyPage.tsx"],
    ["settings", "my-settings", "MySettings.tsx"],
  ];

  for (const [hook, id, expected] of cases) {
    const files = materializePlan(
      buildWebPlan(webModel([hook], { id }), loadLock()),
    );
    const paths = files.map((file) => file.path);

    assert.ok(paths.includes(expected), hook);
    assert.ok(
      !paths.some((file) => /(Settings|Page|Filter|Renderer)\1\.tsx/.test(file)),
      hook,
    );
  }
});

test("sidebar-menu without route warns in the README", () => {
  const lock = loadLock();
  const menuFiles = materializePlan(
    buildWebPlan(webModel(["sidebar-menu"]), lock),
  );
  const menuReadme = menuFiles.find((file) => file.path === "README.md");

  assert.ok(menuReadme);
  assert.match(menuReadme.content, /Warning/);
  assert.match(menuReadme.content, /needs a matching/);

  const routeFiles = materializePlan(
    buildWebPlan(webModel(["route", "sidebar-menu"]), lock),
  );
  const routeReadme = routeFiles.find((file) => file.path === "README.md");

  assert.ok(routeReadme);
  assert.doesNotMatch(routeReadme.content, /needs a matching/);
});
