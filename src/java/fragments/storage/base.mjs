export default {
  id: "storage.base",
  imports: [
    "java.nio.file.Path",
    "java.util.Objects",
    "org.dicoogle.sdk.PluginMetadata",
  ],
  interfaces: [],
  fields: [
    "private static final PluginMetadata METADATA =\n    new PluginMetadata(\"{{id}}\", \"{{name}}\", \"{{pluginVersion}}\", \"{{pluginType}}\");",
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
    "static org.junit.jupiter.api.Assertions.assertEquals",
  ],
  testFields: ["@TempDir Path tempDir;"],
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
  ],
};
