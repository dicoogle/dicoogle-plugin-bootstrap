export default {
  id: "query-index.maintenance",
  imports: [
    "java.io.IOException",
    "java.net.URI",
    "org.dicoogle.sdk.query.QueryIndexMaintenance",
  ],
  interfaces: ["QueryIndexMaintenance"],
  methods: [
    {
      name: "indexId",
      signature: "public String indexId()",
      body: ["return \"{{id}}\";"],
    },
    {
      name: "indexedDocuments",
      signature: "public int indexedDocuments() throws IOException",
      body: ["return index.size();"],
    },
    {
      name: "indexPath",
      signature: "public int indexPath(URI uri) throws IOException",
      body: [
        "String key = \"path:\" + uri;",
        "index.put(key, new IndexEntry(\"UNKNOWN\", \"UNKNOWN\", uri.toString(), \"UNKNOWN\", uri));",
        "return 1;",
      ],
    },
    {
      name: "unindexPath",
      signature: "public int unindexPath(URI uri) throws IOException",
      body: [
        "return index.remove(\"path:\" + uri) == null ? 0 : 1;",
      ],
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
      name: "maintenanceUsesPluginIdAndIndexesPaths",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "assertEquals(\"{{id}}\", plugin.indexId());",
        "URI uri = tempDir.resolve(\"indexed.dcm\").toUri();",
        "assertEquals(1, plugin.indexPath(uri));",
        "assertEquals(1, plugin.indexedDocuments());",
        "assertEquals(1, plugin.unindexPath(uri));",
        "assertEquals(0, plugin.indexedDocuments());",
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
