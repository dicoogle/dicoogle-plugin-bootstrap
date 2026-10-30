import {
  buildQueryIndexModel,
  buildStorageModel,
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
];
