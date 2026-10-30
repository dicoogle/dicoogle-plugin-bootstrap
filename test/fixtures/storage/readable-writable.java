package org.dicoogle.storage.mystore;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.storage.ReadableStoragePlugin;
import org.dicoogle.sdk.storage.StoredObject;
import org.dicoogle.sdk.storage.WritableStoragePlugin;

public class MyStoreStoragePlugin
    implements ReadableStoragePlugin,
        WritableStoragePlugin {

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
  public StoredObject store(InputStream data, String contentType) throws IOException {
    byte[] bytes = data.readAllBytes();
    Files.createDirectories(rootDirectory);
    Path target = rootDirectory.resolve(UUID.randomUUID() + ".dcm");
    Files.write(target, bytes);
    return new StoredObject(target.toUri(), bytes.length, contentType);
  }
}
