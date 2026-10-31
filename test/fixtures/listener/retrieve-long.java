package org.dicoogle.service.fixturelistenerretrievelongidentifier;

import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.service.StorageRetrieveEventListener;
import org.dicoogle.sdk.storage.StorageRetrieveFailureEvent;
import org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class FixtureListenerRetrieveLongIdentifierRetrieveListener
    implements StorageRetrieveEventListener {

  private static final PluginMetadata METADATA =
      new PluginMetadata(
          "fixture-listener-retrieve-long-identifier",
          "My Audit",
          "0.1.0",
          "service");

  private static final Logger LOGGER =
      LoggerFactory.getLogger(FixtureListenerRetrieveLongIdentifierRetrieveListener.class);
  private int retrieveCount;
  private StorageRetrieveSuccessEvent lastEvent;

  @Override
  public PluginMetadata metadata() {
    return METADATA;
  }

  @Override
  public void onRetrieveSuccess(StorageRetrieveSuccessEvent event) {
    try {
      recordRetrieveSuccess(event);
    } catch (RuntimeException ex) {
      LOGGER.warn("Failed to record retrieve success", ex);
    }
  }

  @Override
  public void onRetrieveFailure(StorageRetrieveFailureEvent event) {
    try {
      recordRetrieveFailure(event);
    } catch (RuntimeException ex) {
      LOGGER.warn("Failed to record retrieve failure", ex);
    }
  }

  void recordRetrieveSuccess(StorageRetrieveSuccessEvent event) {
    // TODO: replace the recorded event with real listener logic.
    this.lastEvent = event;
    retrieveCount++;
  }

  void recordRetrieveFailure(StorageRetrieveFailureEvent event) {
    // TODO: handle retrieval failures.
  }

  int retrieveCount() {
    return retrieveCount;
  }

  StorageRetrieveSuccessEvent lastEvent() {
    return lastEvent;
  }
}
