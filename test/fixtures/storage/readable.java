package org.dicoogle.storage.mystore;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.storage.ReadableStoragePlugin;

public class MyStoreStoragePlugin implements ReadableStoragePlugin {

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
  public InputStream openForRead(URI location) throws IOException {
    Path path = pathOf(location);
    return Files.newInputStream(path);
  }
}
