import base from "./base.mjs";
import ingest from "./ingest.mjs";
import retrieve from "./retrieve.mjs";

export { base, ingest, retrieve };

export const LISTENER_INTERFACE_METHODS = Object.freeze({
  StorageIngestEventListener: ["onIngestSuccess"],
  StorageRetrieveEventListener: ["onRetrieveSuccess"],
});

export function listenerClassFragments(model) {
  return [base, model.ingest ? ingest : retrieve];
}

export function listenerTestFragments(model) {
  return [base, model.ingest ? ingest : retrieve];
}

export function expectedListenerMethods(model) {
  const methods = new Set(["metadata"]);
  const interfaceName = model.ingest
    ? "StorageIngestEventListener"
    : "StorageRetrieveEventListener";

  for (const method of LISTENER_INTERFACE_METHODS[interfaceName] ?? []) {
    methods.add(method);
  }

  return [...methods];
}
