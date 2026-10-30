package org.dicoogle.service.myaudit;

import org.dicoogle.sdk.PluginMetadata;
import org.dicoogle.sdk.service.StorageRetrieveEventListener;
import org.dicoogle.sdk.storage.StorageRetrieveFailureEvent;
import org.dicoogle.sdk.storage.StorageRetrieveSuccessEvent;

public class MyAuditRetrieveListener implements StorageRetrieveEventListener {

  private static final PluginMetadata METADATA =
      new PluginMetadata("my-audit", "My Audit", "0.1.0", "service");
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
