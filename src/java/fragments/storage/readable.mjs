export const openForReadMethod = {
  name: "openForRead",
  signature:
    "public InputStream openForRead(URI location) throws IOException",
  body: [
    "Path path = Path.of(location);",
    "return Files.newInputStream(path);",
  ],
};

export default {
  id: "storage.readable",
  imports: [
    "java.io.IOException",
    "java.io.InputStream",
    "java.net.URI",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "org.dicoogle.sdk.storage.ReadableStoragePlugin",
  ],
  interfaces: ["ReadableStoragePlugin"],
  methods: [openForReadMethod],
  testImports: [
    "java.nio.file.Files",
    "java.nio.file.Path",
    "static org.junit.jupiter.api.Assertions.assertArrayEquals",
  ],
  tests: [
    {
      name: "readsBytesFromFile",
      body: [
        "Path file = tempDir.resolve(\"sample.dcm\");",
        "byte[] expected = new byte[] {1, 2, 3};",
        "Files.write(file, expected);",
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "byte[] actual;",
        "try (var input = plugin.openForRead(file.toUri())) {",
        "  actual = input.readAllBytes();",
        "}",
        "assertArrayEquals(expected, actual);",
      ],
    },
  ],
};
