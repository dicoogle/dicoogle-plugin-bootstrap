import {
  buildListenerModel,
  buildQueryIndexModel,
  buildStorageModel,
  buildWebModel,
} from "../src/model.mjs";

export function storageValues(overrides = {}) {
  return {
    id: "my-store",
    family: "storage",
    name: "My Store",
    description: "Demo store",
    author: "Team",
    pluginVersion: "0.1.0",
    license: null,
    type: undefined,
    scheme: "my-store",
    ...overrides,
  };
}

export function storageModel(flags = {}, values = {}) {
  return buildStorageModel({
    flags,
    values: storageValues(values),
  });
}

export const STORAGE_CASES = [
  ["readable", { readable: true }],
  ["writable", { writable: true }],
  ["listable", { listable: true }],
  ["locator", { locator: true }],
  ["readable-writable", { readable: true, writable: true }],
  ["writable-locator", { writable: true, locator: true }],
  [
    "all",
    {
      readable: true,
      writable: true,
      listable: true,
      locator: true,
    },
  ],
];

export function queryIndexValues(overrides = {}) {
  return {
    id: "my-index",
    family: "query-index",
    name: "My Index",
    description: "Demo index",
    author: "Team",
    pluginVersion: "0.1.0",
    license: null,
    type: undefined,
    ...overrides,
  };
}

export function queryIndexModel(flags = {}, values = {}) {
  return buildQueryIndexModel({
    flags,
    values: queryIndexValues(values),
  });
}

export const QUERY_INDEX_CASES = [
  ["ingest", { ingest: true }],
  ["query", { query: true }],
  ["move", { move: true }],
  ["maintenance", { maintenance: true }],
  ["settings", { settings: true }],
  [
    "all",
    {
      ingest: true,
      query: true,
      move: true,
      maintenance: true,
      settings: true,
    },
  ],
  [
    "long-id",
    {
      ingest: true,
      query: true,
      move: true,
      maintenance: true,
      settings: true,
    },
    { id: "fixture-query-index-long-ident" },
  ],
];

export function listenerValues(overrides = {}) {
  return {
    id: "my-audit",
    family: "listener",
    name: "My Audit",
    description: "Demo listener",
    author: "Team",
    pluginVersion: "0.1.0",
    license: null,
    type: undefined,
    ...overrides,
  };
}

export function listenerModel(flags = {}, values = {}) {
  return buildListenerModel({
    flags,
    values: listenerValues(values),
  });
}

export const LISTENER_CASES = [
  ["ingest", { ingest: true }, {}],
  ["retrieve", { retrieve: true }, {}],
  [
    "ingest-long",
    { ingest: true },
    { id: "fixture-listener-ingest-long-identifier" },
  ],
  [
    "retrieve-long",
    { retrieve: true },
    { id: "fixture-listener-retrieve-long-identifier" },
  ],
];


export const WEB_HOOK_CASES = [
  ["query-filter", "Filter"],
  ["result-options", null],
  ["result-batch", null],
  ["result-renderer", "Renderer"],
  ["sidebar-menu", null],
  ["route", "Page"],
  ["settings", "Settings"],
];

export function webModel(hooks = ["query-filter"], overrides = {}) {
  const hookList = Array.isArray(hooks) ? hooks : [hooks];

  return buildWebModel({
    flags: {},
    values: {
      id: "my-web",
      name: "My Web",
      description: "Demo web plugin",
      author: "Team",
      pluginVersion: "0.1.0",
      license: null,
      type: undefined,
      hooks: hookList,
      apiVersion: "1.0",
      pluginType: hookList.length === 1 ? hookList[0] : "multi",
      entry: "index.ts",
      ...overrides,
    },
  });
}
