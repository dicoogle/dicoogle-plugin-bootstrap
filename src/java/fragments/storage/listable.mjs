import { openForReadMethod } from "./readable.mjs";

export default {
  id: "storage.listable",
  imports: [
    "java.io.IOException",
    "java.io.InputStream",
    "java.net.URI",
    "java.nio.file.Files",
    "java.nio.file.Path",
    "java.util.List",
    "org.dicoogle.sdk.storage.ListableStoragePlugin",
  ],
  interfaces: ["ListableStoragePlugin"],
  methods: [
    openForReadMethod,
    {
      name: "listChildren",
      signature:
        "public List<URI> listChildren(URI parent) throws IOException",
      body: [
        "Path directory = pathOf(parent);",
        "if (!Files.isDirectory(directory)) {",
        "  return List.of();",
        "}",
        "try (var children = Files.list(directory)) {",
        "  return children.map(this::toLocation).toList();",
        "}",
      ],
    },
    {
      name: "isDirectory",
      signature: "public boolean isDirectory(URI location) throws IOException",
      body: ["return Files.isDirectory(pathOf(location));"],
    },
  ],
  testImports: [
    "java.nio.file.Files",
    "java.nio.file.Path",
    "static org.junit.jupiter.api.Assertions.assertTrue",
  ],
  tests: [
    {
      name: "listsDirectoryChildren",
      body: [
        "Path child = tempDir.resolve(\"child.dcm\");",
        "Files.write(child, new byte[] {7});",
        "{{ClassName}} plugin = new {{ClassName}}(tempDir, \"{{scheme}}\");",
        "var children = plugin.listChildren(tempDir.toUri());",
        "assertTrue(",
        "    children.stream().anyMatch(uri -> Path.of(uri.getPath()).equals(child.toAbsolutePath())));",
        "assertTrue(plugin.isDirectory(tempDir.toUri()));",
      ],
    },
  ],
};
