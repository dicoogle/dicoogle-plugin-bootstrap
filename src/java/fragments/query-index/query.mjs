export default {
  id: "query-index.query",
  imports: [
    "java.io.IOException",
    "java.util.List",
    "org.dicoogle.sdk.query.QueryService",
  ],
  interfaces: ["QueryService"],
  methods: [
    {
      name: "query",
      signature:
        "public List<QueryResult> query(QueryRequest request) throws IOException",
      body: [
        "// TODO: match request.keys(), freeText, keywordFilters, and level against",
        "// recorded ingest entries before returning QueryResult values.",
        "// Returning an empty list is intentional until matching is implemented.",
        "return List.of();",
      ],
    },
  ],
  testImports: [
    "java.net.URI",
    "java.util.Map",
    "org.dcm4che3.data.Attributes",
    "org.dicoogle.sdk.query.QueryRetrieveLevel",
    "org.dicoogle.sdk.query.QueryService",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "queryReturnsNoUnmatchedEntries",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "plugin.seedIndex(",
        "    \"1.2.3\",",
        "    \"1.2.3.1\",",
        "    \"1.2.3.1.1\",",
        "    \"1.2.840.10008.5.1.4.1.1.7\",",
        "    URI.create(\"file:///tmp/query.dcm\"));",
        "var request =",
        "    new QueryService.QueryRequest(",
        "        QueryService.InformationModel.STUDY_ROOT,",
        "        QueryRetrieveLevel.STUDY,",
        "        \"CALLING\",",
        "        \"CALLED\",",
        "        1,",
        "        new Attributes(),",
        "        null,",
        "        Map.of(),",
        "        false,",
        "        false,",
        "        () -> false,",
        "        null);",
        "assertTrue(plugin.query(request).isEmpty());",
        "assertEquals(1, plugin.indexSize());",
      ],
    },
    {
      name: "isVisibleAsQueryService",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(context -> assertTrue(context.getBeansOfType(QueryService.class).size() == 1));",
      ],
    },
  ],
};
