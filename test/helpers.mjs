import { buildStorageModel } from "../src/model.mjs";

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
