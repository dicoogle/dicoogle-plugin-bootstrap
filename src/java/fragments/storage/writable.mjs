export default {
  id: "storage.writable",
  imports: [
    "java.io.IOException",
    "java.io.InputStream",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "java.util.UUID",
    "org.dicoogle.sdk.storage.StoredObject",
    "org.dicoogle.sdk.storage.WritableStoragePlugin",
  ],
  interfaces: ["WritableStoragePlugin"],
  methods: [
    {
      name: "store",
      signature:
        "public StoredObject store(InputStream data, String contentType) throws IOException",
      body: [
        "byte[] bytes = data.readAllBytes();",
        "Files.createDirectories(rootDirectory);",
        "Path target = rootDirectory.resolve(UUID.randomUUID() + \".dcm\");",
        "Files.write(target, bytes);",
        "return new StoredObject(target.toUri(), bytes.length, contentType);",
      ],
    },
  ],
  testImports: [
    "java.io.ByteArrayInputStream",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "static org.junit.jupiter.api.Assertions.assertEquals",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "storesBytesUnderRoot",
      body: [
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "var stored = plugin.store(new ByteArrayInputStream(new byte[] {4, 5}), \"application/dicom\");",
        "assertEquals(2, stored.contentLength());",
        "assertTrue(Files.isRegularFile(Path.of(stored.location())));",
      ],
    },
  ],
};
