export default {
  id: "storage.writable",
  imports: [
    "java.io.ByteArrayInputStream",
    "java.io.IOException",
    "java.io.InputStream",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "java.util.UUID",
    "org.dcm4che3.data.Tag",
    "org.dcm4che3.io.DicomInputStream",
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
        "String sopInstanceUid = null;",
        "try (DicomInputStream dicom = new DicomInputStream(new ByteArrayInputStream(bytes))) {",
        "  sopInstanceUid = dicom.readDataset().getString(Tag.SOPInstanceUID);",
        "} catch (IOException ignored) {",
        "  // Non-DICOM payloads keep the generated-name fallback.",
        "}",
        "String fileName =",
        "    sopInstanceUid == null || sopInstanceUid.isBlank()",
        "        ? UUID.randomUUID() + \".dcm\"",
        "        : sopInstanceUid.replaceAll(\"[^A-Za-z0-9._-]\", \"_\") + \".dcm\";",
        "Path target = rootDirectory.resolve(fileName);",
        "Files.write(target, bytes);",
        "return new StoredObject(toLocation(target), bytes.length, contentType);",
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
        "assertTrue(Files.isRegularFile(Path.of(stored.location().getPath())));",
      ],
    },
  ],
};
