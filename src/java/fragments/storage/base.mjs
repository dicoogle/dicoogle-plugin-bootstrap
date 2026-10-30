export default {
  id: "storage.base",
  imports: [
    "java.nio.file.Path",
    "java.util.Objects",
    "org.dicoogle.sdk.PluginMetadata",
  ],
  interfaces: [],
  fields: [
    "private static final PluginMetadata METADATA = new PluginMetadata(\"{{id}}\", \"{{name}}\", \"{{pluginVersion}}\", \"{{pluginType}}\");",
    "private final Path rootDirectory;",
    "private final String scheme;",
  ],
  constructor: {
    params: "Path rootDirectory, String scheme",
    body: [
      "this.rootDirectory = Objects.requireNonNull(rootDirectory).toAbsolutePath().normalize();",
      "this.scheme = Objects.requireNonNull(scheme);",
    ],
  },
  methods: [
    {
      name: "metadata",
      signature: "public PluginMetadata metadata()",
      body: ["return METADATA;"],
    },
    {
      name: "scheme",
      signature: "public String scheme()",
      body: ["return scheme;"],
    },
  ],
  testImports: [
    "java.nio.file.Path",
    "org.junit.jupiter.api.Test",
    "org.junit.jupiter.api.io.TempDir",
    "org.springframework.boot.test.context.runner.ApplicationContextRunner",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  testFields: [
    "@TempDir Path tempDir;",
    "private final ApplicationContextRunner contextRunner = new ApplicationContextRunner().withUserConfiguration({{ClassName}}Config.class);",
  ],
  tests: [
    {
      name: "exposesMetadata",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "assertEquals(\"{{id}}\", plugin.metadata().id());",
        "assertEquals(\"{{pluginType}}\", plugin.metadata().type());",
        "assertEquals(\"{{scheme}}\", plugin.scheme());",
      ],
    },
    {
      name: "registersBeanWhenEnabled",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(",
        "        context -> {",
        "          assertEquals(1, context.getBeansOfType({{ClassName}}.class).size());",
        "          {{ClassName}} plugin = context.getBean({{ClassName}}.class);",
        "          assertEquals(\"{{id}}\", plugin.metadata().id());",
        "          assertEquals(\"{{pluginType}}\", plugin.metadata().type());",
        "        });",
      ],
    },
    {
      name: "registersNothingByDefault",
      body: [
        "contextRunner.run(",
        "    context -> assertTrue(context.getBeansOfType({{ClassName}}.class).isEmpty()));",
      ],
    },
  ],
};
