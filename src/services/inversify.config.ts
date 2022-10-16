import { Container } from 'inversify';
import 'reflect-metadata';
import { SERVICE_TYPES } from './types';

// abstract
import { IAppConfigService } from './abstract/IAppConfigService';
import { ILoggingService } from './abstract/ILoggingService';
import { ITimerService } from './abstract/ITimerService';
import { IWebApiService } from './abstract/IWebApiService';
import { IStorageService } from './abstract/IStorageService';
import { ITaskDispatchService } from './abstract/ITaskDispatchService';
import { ITaskService } from './abstract/ITaskService';

// impl
import { AppConfigService } from './impl/AppConfigService';
import { LoggingService } from './impl/LoggingService';
import { TimerService } from './impl/TimerService';
import { WebApiService } from './impl/WebApiService';
import { StorageService } from './impl/StorageService';
import { TaskDispatchService } from './impl/TaskDispatchService';
import { TaskService } from './impl/TaskService';


const appContainer = new Container();
appContainer.bind<IAppConfigService>(SERVICE_TYPES.appConfigService)
  .to(AppConfigService)
  .inSingletonScope();
appContainer.bind<ILoggingService>(SERVICE_TYPES.loggingService)
  .to(LoggingService)
  .inSingletonScope();
appContainer.bind<ITimerService>(SERVICE_TYPES.timerService)
  .to(TimerService)
  .inSingletonScope();
appContainer.bind<IWebApiService>(SERVICE_TYPES.webApiService)
  .to(WebApiService)
  .inSingletonScope();
appContainer.bind<IStorageService>(SERVICE_TYPES.storageService)
  .to(StorageService)
  .inSingletonScope();
appContainer.bind<ITaskDispatchService>(SERVICE_TYPES.taskDispatchService)
  .to(TaskDispatchService)
  .inSingletonScope();
appContainer.bind<ITaskService>(SERVICE_TYPES.taskService)
  .to(TaskService)
  .inSingletonScope();

export { appContainer };
