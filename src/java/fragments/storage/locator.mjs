export default {
  id: "storage.locator",
  imports: [
    "java.io.IOException",
    "java.net.URI",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "java.util.List",
    "java.util.Optional",
    "org.dicoogle.sdk.storage.DicomInstanceLocator",
  ],
  interfaces: ["DicomInstanceLocator"],
  methods: [
    {
      name: "locateInstance",
      signature:
        "public Optional<URI> locateInstance(\n" +
        "      String studyInstanceUid, String seriesInstanceUid, String sopInstanceUid)\n" +
        "      throws IOException",
      body: [
        "if (sopInstanceUid == null || sopInstanceUid.isBlank()) {",
        "  return Optional.empty();",
        "}",
        "Path candidate = rootDirectory.resolve(safeSegment(sopInstanceUid) + \".dcm\");",
        "return Files.isRegularFile(candidate)",
        "    ? Optional.of(candidate.toUri())",
        "    : Optional.empty();",
      ],
    },
    {
      name: "listStudyInstances",
      signature:
        "public List<URI> listStudyInstances(String studyInstanceUid) throws IOException",
      body: ["return List.of();"],
    },
    {
      name: "listSeriesInstances",
      signature:
        "public List<URI> listSeriesInstances(\n" +
        "      String studyInstanceUid, String seriesInstanceUid) throws IOException",
      body: ["return List.of();"],
    },
    {
      name: "safeSegment",
      signature: "private String safeSegment(String value)",
      override: false,
      body: [
        "return value.replaceAll(\"[^A-Za-z0-9._-]\", \"_\");",
      ],
    },
  ],
  testImports: [
    "java.nio.file.Files",
    "java.nio.file.Path",
    "java.util.Optional",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "locatesInstancesAndHandlesUnknownIds",
      body: [
        "String sopInstanceUid = \"1.2.3.4\";",
        "Path file = tempDir.resolve(sopInstanceUid + \".dcm\");",
        "Files.write(file, new byte[] {9});",
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "assertEquals(Optional.of(file.toUri()), plugin.locateInstance(null, null, sopInstanceUid));",
        "assertEquals(Optional.empty(), plugin.locateInstance(null, null, \"missing\"));",
        "assertTrue(plugin.listStudyInstances(\"study\").isEmpty());",
        "assertTrue(plugin.listSeriesInstances(\"study\", \"series\").isEmpty());",
      ],
    },
  ],
};
