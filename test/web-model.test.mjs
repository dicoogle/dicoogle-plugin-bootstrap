import assert from "node:assert/strict";
import test from "node:test";

import { WEB_HOOK_CASES, webModel } from "./helpers.mjs";

test("web model derives hooks, type, entry, and components", () => {
  assert.equal(webModel(["query-filter"]).pluginType, "query-filter");
  assert.equal(webModel(["route", "settings"]).pluginType, "multi");
  assert.equal(webModel(["route"]).entry, "index.ts");
  assert.equal(webModel(["route"]).apiVersion, "1.0");

  assert.deepEqual(
    webModel(["query-filter"]).components.map((entry) => entry.file),
    ["MyWebFilter.tsx"],
  );
  assert.deepEqual(
    webModel(["route", "sidebar-menu", "settings"]).components.map(
      (entry) => entry.file,
    ),
    ["MyWebPage.tsx", "MyWebSettings.tsx"],
  );
});

test("web model covers every supported hook", () => {
  for (const [hook, suffix] of WEB_HOOK_CASES) {
    const model = webModel([hook]);

    assert.equal(model.hooks.length, 1, hook);
    assert.equal(model.hooks[0], hook);
    assert.equal(model.pluginType, hook);
    assert.equal(
      model.components.length,
      suffix ? 1 : 0,
      hook,
    );

    if (suffix) {
      assert.equal(
        model.components[0].className,
        `MyWeb${suffix}`,
        hook,
      );
    }
  }
});

test("web model honors type overrides and default output", () => {
  const model = webModel(["route", "settings"], {
    type: "custom-type",
    pluginType: "multi",
  });

  assert.equal(model.type, "custom-type");
  assert.equal(model.pluginType, "multi");
  assert.equal(model.out, "my-web");
});
