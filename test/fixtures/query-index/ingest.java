package org.dicoogle.query.myindex;

import java.net.URI;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.StorageIngestEventListener;
import org.dicoogle.sdk.storage.StorageIngestFailureEvent;
import org.dicoogle.sdk.storage.StorageIngestSuccessEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MyIndexQueryIndexPlugin implements StorageIngestEventListener {

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

  private static final Logger LOGGER = LoggerFactory.getLogger(MyIndexQueryIndexPlugin.class);

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
  public void onIngestSuccess(StorageIngestSuccessEvent event) {
    try {
      recordIngestSuccess(event);
    } catch (RuntimeException ex) {
      LOGGER.warn("Failed to record ingest success", ex);
    }
  }

  @Override
  public void onIngestFailure(StorageIngestFailureEvent event) {
    try {
      recordIngestFailure(event);
    } catch (RuntimeException ex) {
      LOGGER.warn("Failed to record ingest failure", ex);
    }
  }

  void recordIngestSuccess(StorageIngestSuccessEvent event) {
    // TODO: replace the in-memory index with real indexing logic.
    seedIndex(
        event.studyInstanceUid(),
        event.seriesInstanceUid(),
        event.sopInstanceUid(),
        event.sopClassUid(),
        event.location());
  }

  void recordIngestFailure(StorageIngestFailureEvent event) {
    // TODO: handle ingest failures.
  }
}
