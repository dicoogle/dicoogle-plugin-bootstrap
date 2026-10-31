export default {
  id: "listener.base",
  imports: [
    "org.dicoogle.sdk.DicooglePlugin",
    "org.dicoogle.sdk.PluginMetadata",
  ],
  interfaces: [],
  fields: [
    "private static final PluginMetadata METADATA = new PluginMetadata(\"{{id}}\", \"{{name}}\", \"{{pluginVersion}}\", \"{{pluginType}}\");",
  ],
  methods: [
    {
      name: "metadata",
      signature: "public PluginMetadata metadata()",
      body: ["return METADATA;"],
    },
  ],
  testImports: [
    "org.dicoogle.sdk.DicooglePlugin",
    "org.junit.jupiter.api.Test",
    "org.springframework.boot.test.context.runner.ApplicationContextRunner",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  testFields: [
    "private final ApplicationContextRunner contextRunner = new ApplicationContextRunner().withUserConfiguration({{ClassName}}Config.class);",
  ],
  tests: [
    {
      name: "exposesMetadata",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}();",
        "assertEquals(\"{{id}}\", plugin.metadata().id());",
        "assertEquals(\"{{pluginType}}\", plugin.metadata().type());",
      ],
    },
    {
      name: "registersBeanWhenEnabled",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(",
        "        context -> {",
        "          assertEquals(1, context.getBeansOfType(DicooglePlugin.class).size());",
        "          DicooglePlugin plugin = context.getBean(\"{{beanName}}\", DicooglePlugin.class);",
        "          assertEquals(\"{{id}}\", plugin.metadata().id());",
        "          assertEquals(\"{{pluginType}}\", plugin.metadata().type());",
        "        });",
      ],
    },
    {
      name: "registersNothingWhenDisabled",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=false\")",
        "    .run(context -> assertTrue(context.getBeansOfType(DicooglePlugin.class).isEmpty()));",
      ],
    },
    {
      name: "registersNothingByDefault",
      body: [
        "contextRunner.run(",
        "    context -> assertTrue(context.getBeansOfType(DicooglePlugin.class).isEmpty()));",
      ],
    },
  ],
};
