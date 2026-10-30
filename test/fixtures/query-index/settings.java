package org.dicoogle.query.myindex;

import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.QueryIndexPlugin;
import org.dicoogle.sdk.query.QueryIndexSettings;

public class MyIndexQueryIndexPlugin implements QueryIndexPlugin, QueryIndexSettings {

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
  public String getIndexPath() {
    return properties.getRootDir();
  }

  @Override
  public void setIndexPath(String path) {
    properties.setRootDir(path);
  }

  @Override
  public boolean isWatchEnabled() {
    return properties.isWatchEnabled();
  }

  @Override
  public void setWatchEnabled(boolean watch) {
    properties.setWatchEnabled(watch);
  }
}
