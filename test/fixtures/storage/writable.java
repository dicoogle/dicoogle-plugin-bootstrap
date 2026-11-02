package org.dicoogle.storage.mystore;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;
import org.dcm4che3.data.Tag;
import org.dcm4che3.io.DicomInputStream;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.storage.StoredObject;
import org.dicoogle.sdk.storage.WritableStoragePlugin;

public class MyStoreStoragePlugin implements WritableStoragePlugin {

  private static final PluginMetadata METADATA =
      new PluginMetadata("my-store", "My Store", "0.1.0", "storage");
  private final Path rootDirectory;
  private final String scheme;

  public MyStoreStoragePlugin(Path rootDirectory, String scheme) {
    this.rootDirectory = Objects.requireNonNull(rootDirectory).toAbsolutePath().normalize();
    this.scheme = Objects.requireNonNull(scheme);
  }

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  @Override
  public String scheme() {
    return scheme;
  }

  private URI toLocation(Path path) {
    return scheme.equalsIgnoreCase("file")
        ? path.toUri()
        : URI.create(scheme + ":" + path.toAbsolutePath());
  }

  private Path pathOf(URI location) {
    return "file".equalsIgnoreCase(location.getScheme())
        ? Path.of(location)
        : Path.of(location.getPath());
  }

  @Override
  public StoredObject store(InputStream data, String contentType) throws IOException {
    byte[] bytes = data.readAllBytes();
    Files.createDirectories(rootDirectory);
    String sopInstanceUid = null;
    try (DicomInputStream dicom = new DicomInputStream(new ByteArrayInputStream(bytes))) {
      sopInstanceUid = dicom.readDataset().getString(Tag.SOPInstanceUID);
    } catch (IOException ignored) {
      // Non-DICOM payloads keep the generated-name fallback.
    }
    String fileName =
        sopInstanceUid == null || sopInstanceUid.isBlank()
            ? UUID.randomUUID() + ".dcm"
            : sopInstanceUid.replaceAll("[^A-Za-z0-9._-]", "_") + ".dcm";
    Path target = rootDirectory.resolve(fileName);
    Files.write(target, bytes);
    return new StoredObject(toLocation(target), bytes.length, contentType);
  }
}
