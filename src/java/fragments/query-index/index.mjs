import base from "./base.mjs";
import ingest from "./ingest.mjs";
import maintenance from "./maintenance.mjs";
import move from "./move.mjs";
import query from "./query.mjs";
import settings from "./settings.mjs";

export {
  base,
  ingest,
  maintenance,
  move,
  query,
  settings,
};

export const QUERY_INDEX_INTERFACE_METHODS = Object.freeze({
  QueryIndexPlugin: [],
  StorageIngestEventListener: ["onIngestSuccess"],
  QueryService: ["query"],
  QueryMoveService: ["resolve"],
  QueryIndexMaintenance: [
    "indexId",
    "indexedDocuments",
    "indexPath",
    "unindexPath",
  ],
  QueryIndexSettings: [
    "getIndexPath",
    "setIndexPath",
    "isWatchEnabled",
    "setWatchEnabled",
  ],
});

function capabilityFragments(model) {
  const fragments = [];

  if (model.ingest) {
    fragments.push(ingest);
  }

  if (model.query) {
    fragments.push(query);
  }

  if (model.move) {
    fragments.push(move);
  }

  if (model.maintenance) {
    fragments.push(maintenance);
  }

  if (model.settings) {
    fragments.push(settings);
  }

  return fragments;
}

export function queryIndexClassFragments(model) {
  return [base, ...capabilityFragments(model)];
}

export function queryIndexTestFragments(model) {
  return [base, ...capabilityFragments(model)];
}

export function expectedQueryIndexMethods(model) {
  const methods = new Set(["metadata"]);

  for (const interfaceName of model.interfaces) {
    for (const method of QUERY_INDEX_INTERFACE_METHODS[interfaceName] ?? []) {
      methods.add(method);
    }
  }

  return [...methods];
}
