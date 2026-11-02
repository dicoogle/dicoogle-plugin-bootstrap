import base from "./base.mjs";
import listable from "./listable.mjs";
import locator from "./locator.mjs";
import readable from "./readable.mjs";
import roundTrip from "./round-trip.mjs";
import writable from "./writable.mjs";
import writableLocator from "./writable-locator.mjs";

export {
  base,
  listable,
  locator,
  readable,
  roundTrip,
  writable,
  writableLocator,
};

export const STORAGE_INTERFACE_METHODS = Object.freeze({
  ReadableStoragePlugin: ["openForRead"],
  WritableStoragePlugin: ["store"],
  ListableStoragePlugin: [
    "openForRead",
    "listChildren",
    "isDirectory",
  ],
  DicomInstanceLocator: [
    "locateInstance",
    "listStudyInstances",
    "listSeriesInstances",
  ],
});

export function storageClassFragments(model) {
  const fragments = [base];

  if (model.listable) {
    fragments.push(listable);
  } else if (model.readable) {
    fragments.push(readable);
  }

  if (model.writable) {
    fragments.push(writable);
  }

  if (model.locator) {
    fragments.push(locator);
  }

  return fragments;
}

export function storageTestFragments(model) {
  const fragments = [base];

  if (model.readable) {
    fragments.push(readable);
  }

  if (model.writable) {
    fragments.push(writable);
  }

  if (model.writable && model.locator) {
    fragments.push(writableLocator);
  }

  if (model.readable && model.writable) {
    fragments.push(roundTrip);
  }

  if (model.listable) {
    fragments.push(listable);
  }

  if (model.locator) {
    fragments.push(locator);
  }

  return fragments;
}

export function expectedStorageMethods(model) {
  const methods = new Set(["metadata", "scheme"]);

  for (const interfaceName of model.interfaces) {
    for (const method of STORAGE_INTERFACE_METHODS[interfaceName] ?? []) {
      methods.add(method);
    }
  }

  return [...methods];
}
