export default {
  id: "query-index.base",
  imports: [
    "java.net.URI",
    "java.util.Map",
    "java.util.Objects",
    "java.util.concurrent.ConcurrentHashMap",
    "org.dicoogle.sdk.PluginMetadata",
    "org.dicoogle.sdk.query.QueryIndexPlugin",
  ],
  interfaces: [],
  fields: [
    "private static final PluginMetadata METADATA = new PluginMetadata(\"{{id}}\", \"{{name}}\", \"{{pluginVersion}}\", \"{{pluginType}}\");",
    "private final {{ClassName}}Properties properties;",
    "private final Map<String, IndexEntry> index = new ConcurrentHashMap<>();",
    "private int startCalls;",
    "private int stopCalls;",
    "",
    "private record IndexEntry(\n    String studyInstanceUid,\n    String seriesInstanceUid,\n    String sopInstanceUid,\n    String sopClassUid,\n    URI location) {}",
  ],
  constructor: {
    params: "{{ClassName}}Properties properties",
    body: ["this.properties = Objects.requireNonNull(properties);"],
  },
  methods: [
    {
      name: "metadata",
      signature: "public PluginMetadata metadata()",
      body: ["return METADATA;"],
    },
    {
      name: "start",
      signature: "public void start()",
      body: ["startCalls++;"],
    },
    {
      name: "stop",
      signature: "public void stop()",
      body: ["stopCalls++;"],
    },
    {
      name: "startCount",
      signature: "int startCount()",
      override: false,
      body: ["return startCalls;"],
    },
    {
      name: "stopCount",
      signature: "int stopCount()",
      override: false,
      body: ["return stopCalls;"],
    },
    {
      name: "seedIndex",
      signature:
        "void seedIndex(\n" +
        "      String studyInstanceUid,\n" +
        "      String seriesInstanceUid,\n" +
        "      String sopInstanceUid,\n" +
        "      String sopClassUid,\n" +
        "      URI location)",
      override: false,
      body: [
        "index.put(",
        "    indexKey(studyInstanceUid, seriesInstanceUid, sopInstanceUid),",
        "    new IndexEntry(studyInstanceUid, seriesInstanceUid, sopInstanceUid, sopClassUid, location));",
      ],
    },
    {
      name: "indexSize",
      signature: "int indexSize()",
      override: false,
      body: ["return index.size();"],
    },
    {
      name: "indexKey",
      signature:
        "private String indexKey(\n" +
        "      String studyInstanceUid, String seriesInstanceUid, String sopInstanceUid)",
      override: false,
      body: [
        "return studyInstanceUid + \"|\" + seriesInstanceUid + \"|\" + sopInstanceUid;",
      ],
    },
  ],
  testImports: [
    "java.nio.file.Path",
    "org.dicoogle.sdk.query.QueryIndexPlugin",
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
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
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
        "          assertEquals(1, context.getBeansOfType(QueryIndexPlugin.class).size());",
        "          QueryIndexPlugin plugin = context.getBean(\"queryIndexPlugin\", QueryIndexPlugin.class);",
        "          assertEquals(\"{{id}}\", plugin.metadata().id());",
        "          assertEquals(\"{{pluginType}}\", plugin.metadata().type());",
        "        });",
      ],
    },
    {
      name: "lifecycleRunsOnce",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(",
        "        context -> {",
        "          {{ClassName}} plugin = context.getBean({{ClassName}}.class);",
        "          assertEquals(1, plugin.startCount());",
        "          context.close();",
        "          assertEquals(1, plugin.stopCount());",
        "        });",
      ],
    },
    {
      name: "registersNothingWhenDisabled",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=false\")",
        "    .run(context -> assertTrue(context.getBeansOfType(QueryIndexPlugin.class).isEmpty()));",
      ],
    },
  ],
};
