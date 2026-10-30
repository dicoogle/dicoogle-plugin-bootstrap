package org.dicoogle.query.myindex;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.QueryIndexMaintenance;

public class MyIndexQueryIndexPlugin implements QueryIndexMaintenance {

  private static final PluginMetadata METADATA =
      new PluginMetadata("my-index", "My Index", "0.1.0", "query-index");
  private final MyIndexQueryIndexPluginProperties properties;
  private final Map<String, IndexEntry> index = new ConcurrentHashMap<>();

  private record IndexEntry(
      String studyInstanceUid,
      String seriesInstanceUid,
      String sopInstanceUid,
      String sopClassUid,
      URI location) {}

  public MyIndexQueryIndexPlugin(MyIndexQueryIndexPluginProperties properties) {
    this.properties = Objects.requireNonNull(properties);
  }

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  void seedIndex(
      String studyInstanceUid,
      String seriesInstanceUid,
      String sopInstanceUid,
      String sopClassUid,
      URI location) {
    index.put(
        indexKey(studyInstanceUid, seriesInstanceUid, sopInstanceUid),
        new IndexEntry(studyInstanceUid, seriesInstanceUid, sopInstanceUid, sopClassUid, location));
  }

  int indexSize() {
    return index.size();
  }

  private String indexKey(
      String studyInstanceUid, String seriesInstanceUid, String sopInstanceUid) {
    return studyInstanceUid + "|" + seriesInstanceUid + "|" + sopInstanceUid;
  }

  @Override
  public String indexId() {
    return "my-index";
  }

  @Override
  public int indexedDocuments() throws IOException {
    return index.size();
  }

  @Override
  public int indexPath(URI uri) throws IOException {
    String key = "path:" + uri;
    index.put(key, new IndexEntry("UNKNOWN", "UNKNOWN", uri.toString(), "UNKNOWN", uri));
    return 1;
  }

  @Override
  public int unindexPath(URI uri) throws IOException {
    return index.remove("path:" + uri) == null ? 0 : 1;
  }
}
