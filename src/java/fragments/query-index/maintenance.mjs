export default {
  id: "query-index.maintenance",
  imports: [
    "java.io.IOException",
    "java.net.URI",
    "java.util.Set",
    "java.util.concurrent.ConcurrentHashMap",
    "org.dicoogle.sdk.query.QueryIndexMaintenance",
  ],
  interfaces: ["QueryIndexMaintenance"],
  fields: [
    "",
    "private final Set<String> maintainedPaths = ConcurrentHashMap.newKeySet();",
  ],
  methods: [
    {
      name: "indexId",
      signature: "public String indexId()",
      body: ["return \"{{id}}\";"],
    },
    {
      name: "indexedDocuments",
      signature: "public int indexedDocuments() throws IOException",
      body: ["return maintainedPaths.size();"],
    },
    {
      name: "indexPath",
      signature: "public int indexPath(URI uri) throws IOException",
      body: ["return maintainedPaths.add(uri.toString()) ? 1 : 0;"],
    },
    {
      name: "unindexPath",
      signature: "public int unindexPath(URI uri) throws IOException",
      body: ["return maintainedPaths.remove(uri.toString()) ? 1 : 0;"],
    },
  ],
  testImports: [
    "java.net.URI",
    "org.dicoogle.sdk.query.QueryIndexMaintenance",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "maintenanceUsesOnlyItsOwnPathState",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "assertEquals(\"{{id}}\", plugin.indexId());",
        "URI uri = tempDir.resolve(\"indexed.dcm\").toUri();",
        "assertEquals(1, plugin.indexPath(uri));",
        "assertEquals(1, plugin.indexedDocuments());",
        "assertEquals(0, plugin.indexSize());",
        "assertEquals(0, plugin.indexPath(uri));",
        "assertEquals(1, plugin.unindexPath(uri));",
        "assertEquals(0, plugin.indexedDocuments());",
        "assertEquals(0, plugin.indexSize());",
        "assertEquals(0, plugin.unindexPath(uri));",
      ],
    },
    {
      name: "isVisibleAsMaintenance",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(context -> assertTrue(context.getBeansOfType(QueryIndexMaintenance.class).size() == 1));",
      ],
    },
  ],
};
