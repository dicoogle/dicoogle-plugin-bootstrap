import { escapeXml } from "../plan.mjs";

export function buildProjectData(model, lock) {
  const pin = lock.dicoogleNext;

  return {
    ...model,
    ...pin,
    nameXml: escapeXml(model.name),
    artifactIdXml: escapeXml(model.artifactId),
    groupIdXml: escapeXml(model.groupId),
    versionXml: escapeXml(model.version),
    runVerified: true,
  };
}

export function buildProjectPlan(model, lock) {
  const data = buildProjectData(model, lock);

  return {
    root: model.out,
    family: "project",
    model,
    lock,
    data,
    files: [
      {
        path: "pom.xml",
        kind: "template",
        template: "project/pom.xml.tmpl",
        data,
      },
      {
        path: ".gitignore",
        kind: "template",
        template: "project/gitignore.tmpl",
        data,
      },
      {
        path: "README.md",
        kind: "template",
        template: "project/README.md.tmpl",
        data,
      },
    ],
  };
}
