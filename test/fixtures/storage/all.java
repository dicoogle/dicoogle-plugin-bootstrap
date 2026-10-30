package org.dicoogle.storage.mystore;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.storage.DicomInstanceLocator;
import org.dicoogle.sdk.storage.ListableStoragePlugin;
import org.dicoogle.sdk.storage.StoredObject;
import org.dicoogle.sdk.storage.WritableStoragePlugin;

public class MyStoreStoragePlugin
    implements ListableStoragePlugin,
        WritableStoragePlugin,
        DicomInstanceLocator {

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

  @Override
  public InputStream openForRead(URI location) throws IOException {
    Path path = Path.of(location);
    return Files.newInputStream(path);
  }

  @Override
  public List<URI> listChildren(URI parent) throws IOException {
    Path directory = Path.of(parent);
    if (!Files.isDirectory(directory)) {
      return List.of();
    }
    try (var children = Files.list(directory)) {
      return children.map(Path::toUri).toList();
    }
  }

  @Override
  public boolean isDirectory(URI location) throws IOException {
    return Files.isDirectory(Path.of(location));
  }

  @Override
  public StoredObject store(InputStream data, String contentType) throws IOException {
    byte[] bytes = data.readAllBytes();
    Files.createDirectories(rootDirectory);
    Path target = rootDirectory.resolve(UUID.randomUUID() + ".dcm");
    Files.write(target, bytes);
    return new StoredObject(target.toUri(), bytes.length, contentType);
  }

  @Override
  public Optional<URI> locateInstance(
      String studyInstanceUid, String seriesInstanceUid, String sopInstanceUid)
      throws IOException {
    if (sopInstanceUid == null || sopInstanceUid.isBlank()) {
      return Optional.empty();
    }
    Path candidate = rootDirectory.resolve(safeSegment(sopInstanceUid) + ".dcm");
    return Files.isRegularFile(candidate)
        ? Optional.of(candidate.toUri())
        : Optional.empty();
  }

  @Override
  public List<URI> listStudyInstances(String studyInstanceUid) throws IOException {
    return List.of();
  }

  @Override
  public List<URI> listSeriesInstances(
      String studyInstanceUid, String seriesInstanceUid) throws IOException {
    return List.of();
  }

  private String safeSegment(String value) {
    return value.replaceAll("[^A-Za-z0-9._-]", "_");
  }
}
