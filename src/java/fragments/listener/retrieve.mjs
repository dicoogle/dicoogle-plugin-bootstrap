export default {
  id: "listener.retrieve",
  imports: [
    "org.dicoogle.sdk.service.StorageRetrieveEventListener",
    "org.dicoogle.sdk.storage.StorageRetrieveFailureEvent",
    "org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent",
  ],
  interfaces: ["StorageRetrieveEventListener"],
  fields: [
    "private int retrieveCount;",
    "private StorageRetrieveSuccessEvent lastEvent;",
  ],
  methods: [
    {
      name: "onRetrieveSuccess",
      signature:
        "public void onRetrieveSuccess(StorageRetrieveSuccessEvent event)",
      body: [
        "// TODO: replace the recorded event with real listener logic.",
        "this.lastEvent = event;",
        "retrieveCount++;",
      ],
    },
    {
      name: "onRetrieveFailure",
      signature:
        "public void onRetrieveFailure(StorageRetrieveFailureEvent event)",
      body: ["// TODO: handle retrieval failures."],
    },
    {
      name: "retrieveCount",
      signature: "int retrieveCount()",
      override: false,
      body: ["return retrieveCount;"],
    },
    {
      name: "lastEvent",
      signature: "StorageRetrieveSuccessEvent lastEvent()",
      override: false,
      body: ["return lastEvent;"],
    },
  ],
  testImports: [
    "java.net.URI",
    "org.dicoogle.sdk.query.StorageIngestEventListener",
    "org.dicoogle.sdk.service.StorageRetrieveEventListener",
    "org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "retrieveCallbackRecordsEvent",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}();",
        "plugin.onRetrieveSuccess(",
        "    new StorageRetrieveSuccessEvent(",
        "        \"1.2.3\", \"1.2.3.1\", \"1.2.3.1.1\", \"file\", URI.create(\"file:///tmp/retrieve.dcm\"), 42L));",
        "assertEquals(1, plugin.retrieveCount());",
        "assertEquals(\"1.2.3\", plugin.lastEvent().studyInstanceUid());",
      ],
    },
    {
      name: "isVisibleAsRetrieveListener",
      body: [
        "contextRunner",
        "    .withPropertyValues(\"{{configPrefix}}.enabled=true\")",
        "    .run(",
        "        context -> {",
        "          assertEquals(1, context.getBeansOfType(StorageRetrieveEventListener.class).size());",
        "          assertTrue(context.getBeansOfType(StorageIngestEventListener.class).isEmpty());",
        "        });",
      ],
    },
  ],
};
