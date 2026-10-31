import { renderTemplate } from "../render.mjs";
import { WEB_HOOK_FRAGMENTS } from "./fragments/index.mjs";

function unique(values) {
  return [...new Set(values)];
}

function renderLine(line, data, templateName) {
  return renderTemplate(line, data, { name: templateName });
}

function componentFor(model, hook) {
  return model.components.find((component) => component.hook === hook);
}

export function composeWebEntry(model, data) {
  const fragments = model.hooks.map((hook) => ({
    hook,
    fragment: WEB_HOOK_FRAGMENTS[hook],
    component: componentFor(model, hook),
  }));
  const typeImports = unique([
    "WebUIPlugin",
    ...fragments.flatMap(({ fragment }) => fragment.imports),
  ]);
  const icons = unique(
    fragments.flatMap(({ fragment }) => fragment.icons),
  );
  const components = fragments
    .map(({ component }) => component)
    .filter(Boolean);
  const reactImports = [];

  if (icons.length > 0) {
    reactImports.push("createElement");
  }

  if (components.length > 0) {
    reactImports.push("lazy");
  }

  const lines = [];
  lines.push(
    `import { ${typeImports.join(", ")} } from "@/plugin-system";`,
  );

  if (reactImports.length > 0) {
    lines.push(
      `import { ${reactImports.join(", ")} } from "react";`,
    );
  }

  if (icons.length > 0) {
    lines.push(
      `import { ${icons.join(", ")} } from "lucide-react";`,
    );
  }

  if (lines.length > 1) {
    lines.push("");
  }

  for (const component of components) {
    lines.push(
      `const ${component.className} = lazy(() => import("./${component.className}"));`,
    );
  }

  if (components.length > 0) {
    lines.push("");
  }

  lines.push("const plugin: WebUIPlugin = {");

  fragments.forEach(({ hook, fragment, component }, index) => {
    if (index > 0) {
      lines.push("");
    }

    lines.push(
      ...fragment.method.map((line) =>
        renderLine(line, {
          ...data,
          componentName: component?.className ?? "",
        }, `web/${hook}.method`),
      ),
    );
  });

  lines.push("};", "", "export default plugin;", "");

  return lines.join("\n");
}

export function webComponentTemplateFor(hook) {
  return WEB_HOOK_FRAGMENTS[hook]?.componentTemplate ?? null;
}
