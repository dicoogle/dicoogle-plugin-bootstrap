export default {
  id: "query-index.ingest",
  imports: [
    "java.net.URI",
    "org.dicoogle.sdk.query.StorageIngestEventListener",
    "org.dicoogle.sdk.storage.StorageIngestFailureEvent",
    "org.dicoogle.sdk.storage.StorageIngestSuccessEvent",
  ],
  interfaces: ["StorageIngestEventListener"],
  methods: [
    {
      name: "onIngestSuccess",
      signature:
        "public void onIngestSuccess(StorageIngestSuccessEvent event)",
      body: [
        "// TODO: replace the in-memory index with real indexing logic.",
        "seedIndex(",
        "    event.studyInstanceUid(),",
        "    event.seriesInstanceUid(),",
        "    event.sopInstanceUid(),",
        "    event.sopClassUid(),",
        "    event.location());",
      ],
    },
    {
      name: "onIngestFailure",
      signature:
        "public void onIngestFailure(StorageIngestFailureEvent event)",
      body: ["// TODO: handle ingest failures."],
    },
  ],
  testImports: [
    "java.net.URI",
    "org.dicoogle.sdk.query.StorageIngestEventListener",
    "org.dicoogle.sdk.storage.StorageIngestSuccessEvent",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "ingestAddsEntry",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(new {{ClassName}}Properties());",
        "plugin.onIngestSuccess(",
        "    new StorageIngestSuccessEvent(",
        "        1,",
        "        \"CALLING\",",
        "        \"CALLED\",",
        "        \"file\",",
        "        \"PATIENT-1\",",
        "        \"1.2.3\",",
        "        \"1.2.3.1\",",
        "        \"1.2.3.1.1\",",
        "        \"1.2.840.10008.5.1.4.1.1.7\",",
        "        URI.create(\"file:///tmp/ingest.dcm\")));",
        "assertEquals(1, plugin.indexSize());",
      ],
    },
    {
      name: "isVisibleAsIngestListener",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(context -> assertTrue(context.getBeansOfType(StorageIngestEventListener.class).size() == 1));",
      ],
    },
  ],
};
