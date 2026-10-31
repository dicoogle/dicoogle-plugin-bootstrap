import { UsageError } from "./errors.mjs";

export const JAVA_FAMILY_DOMAINS = Object.freeze({
  storage: "storage",
  "query-index": "query",
});

export const LISTENER_IDENTITIES = Object.freeze({
  ingest: Object.freeze({
    domain: "query",
    pluginType: "query-index",
    classSuffix: "IngestListener",
  }),
  retrieve: Object.freeze({
    domain: "service",
    pluginType: "service",
    classSuffix: "RetrieveListener",
  }),
});

export const WEB_COMPONENT_SUFFIXES = Object.freeze({
  "query-filter": "Filter",
  "result-renderer": "Renderer",
  route: "Page",
  settings: "Settings",
});

export function idTokens(id) {
  return String(id)
    .split("-")
    .filter((token) => token.length > 0);
}

export function capitalizeToken(token) {
  if (token.length === 0) {
    return token;
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function pascalCase(id) {
  return idTokens(id).map(capitalizeToken).join("");
}

export function titleCase(id) {
  return idTokens(id).map(capitalizeToken).join(" ");
}

export function lowerCamelCase(value) {
  const text = String(value);
  return text.length === 0
    ? text
    : text.charAt(0).toLowerCase() + text.slice(1);
}

export function packageSegment(id) {
  return String(id).replaceAll("-", "");
}

export function packagePath(packageName) {
  return String(packageName).replaceAll(".", "/");
}

export function artifactIdFor(id, domain) {
  return `dicoogle-next-${domain}-${id}`;
}

export function defaultPackageFor(id, domain) {
  return `org.dicoogle.${domain}.${packageSegment(id)}`;
}

export function configPrefixFor(id, domain) {
  return `app.${domain}.${id}`;
}

export function classNameFor(id, suffix) {
  return `${pascalCase(id)}${suffix}`;
}

export function listenerIdentity(listenerKind) {
  const identity = LISTENER_IDENTITIES[listenerKind];

  if (!identity) {
    throw new UsageError(
      'listener kind must be "ingest" or "retrieve".',
    );
  }

  return identity;
}

export function familyDomain(family, listenerKind) {
  if (family === "listener") {
    return listenerIdentity(listenerKind).domain;
  }

  const domain = JAVA_FAMILY_DOMAINS[family];

  if (!domain) {
    throw new UsageError(`unknown Java family "${family}".`);
  }

  return domain;
}

export function familyPluginType(family, listenerKind) {
  switch (family) {
    case "storage":
      return "storage";
    case "query-index":
      return "query-index";
    case "listener":
      return listenerIdentity(listenerKind).pluginType;
    default:
      throw new UsageError(`unknown Java family "${family}".`);
  }
}

export function classSuffixFor(family, options = {}) {
  switch (family) {
    case "storage":
      return "StoragePlugin";
    case "query-index":
      return "QueryIndexPlugin";
    case "listener":
      return listenerIdentity(options.listenerKind).classSuffix;
    default:
      throw new UsageError(`unknown Java family "${family}".`);
  }
}

export function classSuffixesFor({ family, listenerKind }) {
  return [classSuffixFor(family, { listenerKind })];
}

export function deriveJavaIdentity({
  family,
  id,
  listenerKind,
  packageName,
  scheme,
  typeOverride,
}) {
  const domain = familyDomain(family, listenerKind);
  const pluginType = typeOverride ?? familyPluginType(family, listenerKind);
  const resolvedPackage = packageName ?? defaultPackageFor(id, domain);
  const suffixes = classSuffixesFor({ family, listenerKind });
  const classes = suffixes.map((suffix) => ({
    suffix,
    className: classNameFor(id, suffix),
  }));

  return {
    family,
    id,
    domain,
    pluginType,
    artifactId: artifactIdFor(id, domain),
    package: resolvedPackage,
    packagePath: packagePath(resolvedPackage),
    configPrefix: configPrefixFor(id, domain),
    configName: id,
    scheme: family === "storage" ? scheme ?? id : undefined,
    classes,
    className: classes[0]?.className ?? null,
    beanName: classes[0]?.className
      ? lowerCamelCase(classes[0].className)
      : null,
  };
}

export function webPluginType(hooks, typeOverride) {
  if (typeOverride) {
    return typeOverride;
  }

  return hooks.length === 1 ? hooks[0] : "multi";
}

export function deriveWebIdentity({
  id,
  hooks,
  typeOverride,
  apiVersion,
}) {
  const components = hooks
    .filter((hook) => Object.hasOwn(WEB_COMPONENT_SUFFIXES, hook))
    .map((hook) => {
      const className = classNameFor(id, WEB_COMPONENT_SUFFIXES[hook]);
      return {
        hook,
        className,
        file: `${className}.tsx`,
      };
    });

  return {
    id,
    hooks: [...hooks],
    pluginType: webPluginType(hooks, typeOverride),
    apiVersion,
    entry: "index.ts",
    components,
  };
}

export function packageCollisionKey(id) {
  return packageSegment(id);
}

export function findPackageCollisions(ids) {
  const groups = new Map();

  for (const id of ids) {
    const key = packageCollisionKey(id);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    const group = groups.get(key);

    if (!group.includes(id)) {
      group.push(id);
    }
  }

  return [...groups.entries()]
    .filter(([, groupedIds]) => groupedIds.length > 1)
    .map(([segment, groupedIds]) => ({
      packageSegment: segment,
      ids: groupedIds,
    }));
}

export function packageCollisionWarnings(id, knownIds = []) {
  const collisions = findPackageCollisions([...new Set([...knownIds, id])]);

  return collisions.flatMap((collision) => {
    if (!collision.ids.includes(id)) {
      return [];
    }

    const others = collision.ids.filter((otherId) => otherId !== id);

    if (others.length === 0) {
      return [];
    }

    return [
      `plugin id "${id}" normalizes to Java package segment ` +
        `"${collision.packageSegment}", which collides with ` +
        `${others.map((otherId) => `"${otherId}"`).join(", ")}. ` +
        "Use --package to choose a distinct Java package.",
    ];
  });
}
