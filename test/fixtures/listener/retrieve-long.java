package org.dicoogle.service.fixturelistenerretrievelongidentifier;

import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.service.StorageRetrieveEventListener;
import org.dicoogle.sdk.storage.StorageRetrieveFailureEvent;
import org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent;

public class FixtureListenerRetrieveLongIdentifierRetrieveListener
    implements StorageRetrieveEventListener {

  private static final PluginMetadata METADATA =
      new PluginMetadata(
          "fixture-listener-retrieve-long-identifier",
          "My Audit",
          "0.1.0",
          "service");
  private int retrieveCount;
  private StorageRetrieveSuccessEvent lastEvent;

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  @Override
  public void onRetrieveSuccess(StorageRetrieveSuccessEvent event) {
    // TODO: replace the recorded event with real listener logic.
    this.lastEvent = event;
    retrieveCount++;
  }

  @Override
  public void onRetrieveFailure(StorageRetrieveFailureEvent event) {
    // TODO: handle retrieval failures.
  }

  int retrieveCount() {
    return retrieveCount;
  }

  StorageRetrieveSuccessEvent lastEvent() {
    return lastEvent;
  }
}
