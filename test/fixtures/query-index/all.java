package org.dicoogle.query.myindex;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.VR;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.QueryIndexMaintenance;
import org.dicoogle.sdk.query.QueryIndexSettings;
import org.dicoogle.sdk.query.QueryMoveService;
import org.dicoogle.sdk.query.QueryService;
import org.dicoogle.sdk.query.StorageIngestEventListener;
import org.dicoogle.sdk.storage.StorageIngestFailureEvent;
import org.dicoogle.sdk.storage.StorageIngestSuccessEvent;

public class MyIndexQueryIndexPlugin
    implements StorageIngestEventListener,
        QueryService,
        QueryMoveService,
        QueryIndexMaintenance,
        QueryIndexSettings {

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
  public void onIngestSuccess(StorageIngestSuccessEvent event) {
    // TODO: replace the in-memory index with real indexing logic.
    seedIndex(
        event.studyInstanceUid(),
        event.seriesInstanceUid(),
        event.sopInstanceUid(),
        event.sopClassUid(),
        event.location());
  }

  @Override
  public void onIngestFailure(StorageIngestFailureEvent event) {
    // TODO: handle ingest failures.
  }

  @Override
  public List<QueryResult> query(QueryRequest request) throws IOException {
    // TODO: replace the in-memory scan with real query logic.
    List<QueryResult> results = new ArrayList<>();
    for (IndexEntry entry : index.values()) {
      if (request.cancelRequested() != null && request.cancelRequested().getAsBoolean()) {
        break;
      }
      Attributes attributes = new Attributes();
      attributes.setString(Tag.StudyInstanceUID, VR.UI, entry.studyInstanceUid());
      attributes.setString(Tag.SeriesInstanceUID, VR.UI, entry.seriesInstanceUid());
      attributes.setString(Tag.SOPInstanceUID, VR.UI, entry.sopInstanceUid());
      results.add(new QueryResult(attributes, entry.location()));
    }
    return results;
  }

  @Override
  public List<MoveCandidate> resolve(MoveRequest request) throws IOException {
    // TODO: replace the in-memory scan with real move resolution.
    List<MoveCandidate> results = new ArrayList<>();
    for (IndexEntry entry : index.values()) {
      if (request.cancelRequested() != null && request.cancelRequested().getAsBoolean()) {
        break;
      }
      results.add(new MoveCandidate(entry.sopClassUid(), entry.sopInstanceUid(), entry.location()));
    }
    return results;
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
