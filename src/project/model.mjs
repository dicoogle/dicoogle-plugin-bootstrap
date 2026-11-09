import { UsageError } from "../errors.mjs";

export function buildProjectModel({ flags = {}, values }) {
  if (!values || !values.id) {
    throw new UsageError(
      "the project model requires a project id.",
    );
  }

  return {
    id: values.id,
    name: values.name,
    groupId: values.groupId,
    version: values.version,
    artifactId: values.id,
    out: flags.out ?? values.id,
    force: flags.force === true,
    dryRun: flags.dryRun === true,
  };
}
