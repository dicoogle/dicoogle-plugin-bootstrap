export default {
  id: "storage.round-trip",
  imports: [],
  interfaces: [],
  methods: [],
  testImports: [
    "java.io.ByteArrayInputStream",
    "static org.junit.jupiter.api.Assertions.assertArrayEquals",
  ],
  tests: [
    {
      name: "roundTripsStoredBytes",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "byte[] expected = new byte[] {6, 7, 8};",
        "var stored =",
        "    plugin.store(new ByteArrayInputStream(expected), \"application/dicom\");",
        "byte[] actual;",
        "try (var input = plugin.openForRead(stored.location())) {",
        "  actual = input.readAllBytes();",
        "}",
        "assertArrayEquals(expected, actual);",
      ],
    },
  ],
};
