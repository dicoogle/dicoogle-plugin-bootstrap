package org.dicoogle.query.myindex;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.QueryIndexMaintenance;

public class MyIndexQueryIndexPlugin implements QueryIndexMaintenance {

  private static final PluginMetadata METADATA =
      new PluginMetadata("my-index", "My Index", "0.1.0", "query-index");
  private final MyIndexQueryIndexPluginProperties properties;
  private final Map<String, IndexEntry> index = new ConcurrentHashMap<>();
  private int startCalls;
  private int stopCalls;

  private record IndexEntry(
      String studyInstanceUid,
      String seriesInstanceUid,
      String sopInstanceUid,
      String sopClassUid,
      URI location) {}

  private final Set<String> maintainedPaths = ConcurrentHashMap.newKeySet();

  public MyIndexQueryIndexPlugin(MyIndexQueryIndexPluginProperties properties) {
    this.properties = Objects.requireNonNull(properties);
  }

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  @Override
  public void start() {
    startCalls++;
  }

  @Override
  public void stop() {
    stopCalls++;
  }

  int startCount() {
    return startCalls;
  }

  int stopCount() {
    return stopCalls;
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
    return maintainedPaths.size();
  }

  @Override
  public int indexPath(URI uri) throws IOException {
    return maintainedPaths.add(uri.toString()) ? 1 : 0;
  }

  @Override
  public int unindexPath(URI uri) throws IOException {
    return maintainedPaths.remove(uri.toString()) ? 1 : 0;
  }
}
