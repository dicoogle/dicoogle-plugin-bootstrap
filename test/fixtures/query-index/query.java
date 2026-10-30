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
import org.dicoogle.sdk.query.QueryService;

public class MyIndexQueryIndexPlugin implements QueryService {

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
}
