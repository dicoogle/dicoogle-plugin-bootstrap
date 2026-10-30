package org.dicoogle.query.myindex;

import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.QueryMoveService;

public class MyIndexQueryIndexPlugin implements QueryMoveService {

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
}
