import { UsageError } from "./errors.mjs";
import { deriveJavaIdentity } from "./naming.mjs";

const STORAGE_CAPABILITIES = [
  "readable",
  "writable",
  "listable",
  "locator",
];

const QUERY_INDEX_CAPABILITIES = [
  "ingest",
  "query",
  "move",
  "maintenance",
  "settings",
];

export function buildStorageModel({ flags = {}, values }) {
  if (!values || values.family !== "storage") {
    throw new UsageError(
      'the storage model requires --family "storage".',
    );
  }

  let readable = flags.readable === true;
  let writable = flags.writable === true;
  let listable = flags.listable === true;
  const locator = flags.locator === true;

  if (listable) {
    readable = true;
  }

  if (!readable && !writable && !listable) {
    // A storage family must implement a concrete StoragePlugin.
    // Zero flags and locator-only both fall back to readable.
    readable = true;
  }

  const capabilityState = {
    readable,
    writable,
    listable,
    locator,
  };
  const capabilities = STORAGE_CAPABILITIES.filter(
    (capability) => capabilityState[capability],
  );
  const interfaces = [];

  if (listable) {
    interfaces.push("ListableStoragePlugin");
  } else if (readable) {
    interfaces.push("ReadableStoragePlugin");
  }

  if (writable) {
    interfaces.push("WritableStoragePlugin");
  }

  if (locator) {
    interfaces.push("DicomInstanceLocator");
  }

  const identity = deriveJavaIdentity({
    family: "storage",
    id: values.id,
    packageName: values.package,
    scheme: values.scheme,
    typeOverride: values.type,
  });

  const licenseHeader = values.license
    ? `// SPDX-License-Identifier: ${values.license}`
    : "";

  return {
    family: "storage",
    id: values.id,
    name: values.name,
    description: values.description,
    author: values.author,
    pluginVersion: values.pluginVersion,
    license: values.license,
    licenseHeader,
    type: values.type,
    ...identity,
    capabilities,
    readable,
    writable,
    listable,
    locator,
    interfaces,
    enabledDefault: false,
    matchIfMissing: false,
    out: flags.out ?? identity.artifactId,
    force: flags.force === true,
    dryRun: flags.dryRun === true,
    repo: flags.repo,
  };
}

export function buildQueryIndexModel({ flags = {}, values }) {
  if (!values || values.family !== "query-index") {
    throw new UsageError(
      'the query-index model requires --family "query-index".',
    );
  }

  if (flags.locator === true) {
    throw new UsageError(
      "--locator is not supported for the query-index family: only " +
        "storage plugins feed List<DicomInstanceLocator> on " +
        "dicoogle-next HEAD.",
    );
  }

  const state = {
    ingest: flags.ingest === true,
    query: flags.query === true,
    move: flags.move === true,
    maintenance: flags.maintenance === true,
    settings: flags.settings === true,
  };
  const capabilities = QUERY_INDEX_CAPABILITIES.filter(
    (capability) => state[capability],
  );

  if (capabilities.length === 0) {
    throw new UsageError(
      "query-index requires at least one of --ingest, --query, " +
        "--move, --maintenance, or --settings.",
    );
  }

  const interfaces = [];

  if (state.ingest) {
    interfaces.push("StorageIngestEventListener");
  }

  if (state.query) {
    interfaces.push("QueryService");
  }

  if (state.move) {
    interfaces.push("QueryMoveService");
  }

  if (state.maintenance) {
    interfaces.push("QueryIndexMaintenance");
  }

  if (state.settings) {
    interfaces.push("QueryIndexSettings");
  }

  const hasMarker =
    state.ingest ||
    state.query ||
    state.move ||
    state.maintenance;

  if (state.settings && !hasMarker) {
    interfaces.unshift("QueryIndexPlugin");
  }

  const identity = deriveJavaIdentity({
    family: "query-index",
    id: values.id,
    packageName: values.package,
    typeOverride: values.type,
  });

  const licenseHeader = values.license
    ? `// SPDX-License-Identifier: ${values.license}`
    : "";

  return {
    family: "query-index",
    id: values.id,
    name: values.name,
    description: values.description,
    author: values.author,
    pluginVersion: values.pluginVersion,
    license: values.license,
    licenseHeader,
    type: values.type,
    ...identity,
    capabilities,
    ingest: state.ingest,
    query: state.query,
    move: state.move,
    maintenance: state.maintenance,
    settings: state.settings,
    interfaces,
    enabledDefault: true,
    matchIfMissing: true,
    indexId: values.id,
    out: flags.out ?? identity.artifactId,
    force: flags.force === true,
    dryRun: flags.dryRun === true,
    repo: flags.repo,
  };
}

export function buildListenerModel({ flags = {}, values }) {
  if (!values || values.family !== "listener") {
    throw new UsageError(
      'the listener model requires --family "listener".',
    );
  }

  const ingest = flags.ingest === true;
  const retrieve = flags.retrieve === true;

  if (ingest === retrieve) {
    throw new UsageError(
      "listener requires exactly one of --ingest or --retrieve.",
    );
  }

  const listenerKind = ingest ? "ingest" : "retrieve";
  const identity = deriveJavaIdentity({
    family: "listener",
    id: values.id,
    listenerKind,
    packageName: values.package,
    typeOverride: values.type,
  });
  const licenseHeader = values.license
    ? `// SPDX-License-Identifier: ${values.license}`
    : "";

  return {
    family: "listener",
    id: values.id,
    name: values.name,
    description: values.description,
    author: values.author,
    pluginVersion: values.pluginVersion,
    license: values.license,
    licenseHeader,
    type: values.type,
    ...identity,
    listenerKind,
    ingest,
    retrieve,
    interfaces: [
      ingest
        ? "StorageIngestEventListener"
        : "StorageRetrieveEventListener",
    ],
    capabilities: [listenerKind],
    enabledDefault: true,
    matchIfMissing: true,
    out: flags.out ?? identity.artifactId,
    force: flags.force === true,
    dryRun: flags.dryRun === true,
    repo: flags.repo,
  };
}
