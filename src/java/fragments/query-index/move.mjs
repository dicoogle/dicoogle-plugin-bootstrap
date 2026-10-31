export default {
  id: "query-index.move",
  imports: [
    "java.io.IOException",
    "java.util.List",
    "org.dicoogle.sdk.query.QueryMoveService",
  ],
  interfaces: ["QueryMoveService"],
  methods: [
    {
      name: "resolve",
      signature:
        "public List<MoveCandidate> resolve(MoveRequest request) throws IOException",
      body: [
        "// TODO: match request.keys() and level against recorded ingest entries",
        "// before returning MoveCandidate values.",
        "// Returning an empty list is intentional until matching is implemented.",
        "return List.of();",
      ],
    },
  ],
  testImports: [
    "java.net.URI",
    "org.dcm4che3.data.Attributes",
    "org.dicoogle.sdk.query.QueryMoveService",
    "org.dicoogle.sdk.query.QueryRetrieveLevel",
    "org.dicoogle.sdk.query.QueryService",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "moveReturnsNoUnmatchedEntries",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "plugin.seedIndex(",
        "    \"1.2.3\",",
        "    \"1.2.3.1\",",
        "    \"1.2.3.1.1\",",
        "    \"1.2.840.10008.5.1.4.1.1.7\",",
        "    URI.create(\"file:///tmp/move.dcm\"));",
        "var request =",
        "    new QueryMoveService.MoveRequest(",
        "        QueryService.InformationModel.STUDY_ROOT,",
        "        QueryRetrieveLevel.STUDY,",
        "        \"CALLING\",",
        "        \"CALLED\",",
        "        \"DESTINATION\",",
        "        1,",
        "        new Attributes(),",
        "        () -> false);",
        "assertTrue(plugin.resolve(request).isEmpty());",
        "assertEquals(1, plugin.indexSize());",
      ],
    },
    {
      name: "isVisibleAsMoveService",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(context -> assertTrue(context.getBeansOfType(QueryMoveService.class).size() == 1));",
      ],
    },
  ],
};
