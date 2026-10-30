package org.dicoogle.query.fixturelisteneringestlongidentifier;

import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.query.StorageIngestEventListener;
import org.dicoogle.sdk.storage.StorageIngestFailureEvent;
import org.dicoogle.sdk.storage.StorageIngestSuccessEvent;

public class FixtureListenerIngestLongIdentifierIngestListener
    implements StorageIngestEventListener {

  private static final PluginMetadata METADATA =
      new PluginMetadata(
          "fixture-listener-ingest-long-identifier",
          "My Audit",
          "0.1.0",
          "query-index");
  private int ingestCount;
  private StorageIngestSuccessEvent lastEvent;

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  @Override
  public void onIngestSuccess(StorageIngestSuccessEvent event) {
    // TODO: replace the recorded event with real listener logic.
    this.lastEvent = event;
    ingestCount++;
  }

  @Override
  public void onIngestFailure(StorageIngestFailureEvent event) {
    // TODO: handle ingest failures.
  }

  int ingestCount() {
    return ingestCount;
  }

  StorageIngestSuccessEvent lastEvent() {
    return lastEvent;
  }
}
