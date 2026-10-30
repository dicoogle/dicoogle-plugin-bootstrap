import { UsageError } from "./errors.mjs";
import { deriveJavaIdentity } from "./naming.mjs";

const STORAGE_CAPABILITIES = [
  "readable",
  "writable",
  "listable",
  "locator",
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
