const SERVICE_TYPES = {
  appConfigService: Symbol.for('IAppConfigService'),
  loggingService: Symbol.for('ILoggingService'),
  timerService: Symbol.for('ITimerService'),
  webApiService: Symbol.for('IWebApiService'),
  storageService: Symbol.for('IStorageService'),
  taskDispatchService: Symbol.for('ITaskDispatchService'),
  taskService: Symbol.for('ITaskService'),
};

export { SERVICE_TYPES };
