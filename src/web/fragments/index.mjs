export const WEB_HOOK_FRAGMENTS = Object.freeze({
  "query-filter": {
    imports: ["QueryFilterExtension"],
    icons: [],
    componentTemplate: "web/query-filter.tsx.tmpl",
    method: [
      "  getQueryFilterExtensions: (): QueryFilterExtension[] => [",
      "    {",
      '      id: "{{id}}-filter",',
      "      label: {{nameJs}},",
      "      description: {{descriptionJs}},",
      "      component: {{componentName}},",
      "      defaultValue: { enabled: false },",
      "      order: 100,",
      "    },",
      "  ],",
    ],
  },
  "result-options": {
    imports: ["ResultOptionActionArgs", "ResultOptionsExtension"],
    icons: ["Download"],
    componentTemplate: null,
    method: [
      "  getResultOptionsExtensions: (): ResultOptionsExtension[] => [",
      "    {",
      '      id: "{{id}}-result-option",',
      "      label: {{nameJs}},",
      '      icon: createElement(Download, { className: "w-4 h-4" }),',
      "      order: 100,",
      "      action: ({ result, context }: ResultOptionActionArgs) => {",
      "        context.logger.info({{nameJs}}, {",
      "          studyInstanceUID: result.studyInstanceUID,",
      "        });",
      '        context.ui?.showToast({{nameJs}}, "info");',
      "      },",
      "    },",
      "  ],",
    ],
  },
  "result-batch": {
    imports: ["ResultBatchActionArgs", "ResultBatchExtension"],
    icons: ["Download"],
    componentTemplate: null,
    method: [
      "  getResultBatchExtensions: (): ResultBatchExtension[] => [",
      "    {",
      '      id: "{{id}}-result-batch",',
      "      label: {{nameJs}},",
      '      icon: createElement(Download, { className: "w-4 h-4" }),',
      "      order: 100,",
      "      action: ({ results, context }: ResultBatchActionArgs) => {",
      "        context.logger.info({{nameJs}}, {",
      "          resultCount: results.length,",
      "        });",
      '        context.ui?.showToast({{nameJs}}, "info");',
      "      },",
      "    },",
      "  ],",
    ],
  },
  "result-renderer": {
    imports: ["ResultRendererExtension"],
    icons: ["LayoutGrid"],
    componentTemplate: "web/result-renderer.tsx.tmpl",
    method: [
      "  getResultRendererExtensions: (): ResultRendererExtension[] => [",
      "    {",
      '      id: "{{id}}-renderer",',
      "      name: {{nameJs}},",
      '      icon: createElement(LayoutGrid, { className: "w-4 h-4" }),',
      "      component: {{componentName}},",
      "      order: 100,",
      "    },",
      "  ],",
    ],
  },
  "sidebar-menu": {
    imports: ["SidebarMenuExtension"],
    icons: ["Menu"],
    componentTemplate: null,
    method: [
      "  getSidebarMenuExtensions: (): SidebarMenuExtension[] => [",
      "    {",
      '      id: "{{id}}-menu",',
      "      label: {{nameJs}},",
      '      icon: createElement(Menu, { className: "w-4 h-4" }),',
      '      path: "/plugins/{{id}}",',
      "      order: 100,",
      "    },",
      "  ],",
    ],
  },
  route: {
    imports: ["RouteExtension"],
    icons: [],
    componentTemplate: "web/route.tsx.tmpl",
    method: [
      "  getRouteExtensions: (): RouteExtension[] => [",
      "    {",
      '      path: "/plugins/{{id}}",',
      "      name: {{nameJs}},",
      "      component: {{componentName}},",
      "    },",
      "  ],",
    ],
  },
  settings: {
    imports: ["SettingsExtension"],
    icons: ["Settings"],
    componentTemplate: "web/settings.tsx.tmpl",
    method: [
      "  getSettingsExtensions: (): SettingsExtension[] => [",
      "    {",
      '      id: "{{id}}-settings",',
      "      label: {{nameJs}},",
      '      icon: createElement(Settings, { className: "w-4 h-4" }),',
      "      component: {{componentName}},",
      "      order: 100,",
      "    },",
      "  ],",
    ],
  },
});

export function hookFragment(hook) {
  const fragment = WEB_HOOK_FRAGMENTS[hook];

  if (!fragment) {
    throw new Error(`unknown web hook "${hook}"`);
  }

  return fragment;
}
