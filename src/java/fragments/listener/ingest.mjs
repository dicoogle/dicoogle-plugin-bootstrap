export default {
  id: "listener.ingest",
  imports: [
    "org.dicoogle.sdk.query.StorageIngestEventListener",
    "org.dicoogle.sdk.storage.StorageIngestFailureEvent",
    "org.dicoogle.sdk.storage.StorageIngestSuccessEvent",
  ],
  interfaces: ["StorageIngestEventListener"],
  fields: [
    "private int ingestCount;",
    "private StorageIngestSuccessEvent lastEvent;",
  ],
  methods: [
    {
      name: "onIngestSuccess",
      signature:
        "public void onIngestSuccess(StorageIngestSuccessEvent event)",
      body: [
        "// TODO: replace the recorded event with real listener logic.",
        "this.lastEvent = event;",
        "ingestCount++;",
      ],
    },
    {
      name: "onIngestFailure",
      signature:
        "public void onIngestFailure(StorageIngestFailureEvent event)",
      body: ["// TODO: handle ingest failures."],
    },
    {
      name: "ingestCount",
      signature: "int ingestCount()",
      override: false,
      body: ["return ingestCount;"],
    },
    {
      name: "lastEvent",
      signature: "StorageIngestSuccessEvent lastEvent()",
      override: false,
      body: ["return lastEvent;"],
    },
  ],
  testImports: [
    "java.net.URI",
    "org.dicoogle.sdk.query.StorageIngestEventListener",
    "org.dicoogle.sdk.service.StorageRetrieveEventListener",
    "org.dicoogle.sdk.storage.StorageIngestSuccessEvent",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "ingestCallbackRecordsEvent",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}();",
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
        "assertEquals(1, plugin.ingestCount());",
        "assertEquals(\"1.2.3\", plugin.lastEvent().studyInstanceUid());",
      ],
    },
    {
      name: "isVisibleAsIngestListener",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(",
        "        context -> {",
        "          assertEquals(1, context.getBeansOfType(StorageIngestEventListener.class).size());",
        "          assertTrue(context.getBeansOfType(StorageRetrieveEventListener.class).isEmpty());",
        "        });",
      ],
    },
  ],
};
