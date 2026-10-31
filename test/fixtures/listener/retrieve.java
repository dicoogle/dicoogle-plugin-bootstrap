package org.dicoogle.service.myaudit;

import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.service.StorageRetrieveEventListener;
import org.dicoogle.sdk.storage.StorageRetrieveFailureEvent;
import org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MyAuditRetrieveListener implements StorageRetrieveEventListener {

  private static final PluginMetadata METADATA =
      new PluginMetadata("my-audit", "My Audit", "0.1.0", "service");

  private static final Logger LOGGER = LoggerFactory.getLogger(MyAuditRetrieveListener.class);
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
