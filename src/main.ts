import yargs from 'yargs';
import { appContainer } from './services/inversify.config';
import { SERVICE_TYPES } from './services/types';
import { IAppConfigService } from './services/abstract/IAppConfigService';
import { IStorageService } from './services/abstract/IStorageService';
import { IWebApiService } from './services/abstract/IWebApiService';
import { ITaskDispatchService } from './services/abstract/ITaskDispatchService';
import { ITaskService } from './services/abstract/ITaskService';


async function main() {
  const argv = yargs
    .option('config', {
      alias: 'c',
      description: 'Specific the configuration file',
      type: 'string',
      required: false,
    })
    .help()
    .alias('help', 'h')
    .argv;

  // 从命令行读取配置文件
  const configService = appContainer.get<IAppConfigService>(SERVICE_TYPES.appConfigService);
  if (argv.config)
    await configService.loadFromJsonFile(argv.config);

  // 初始化DB
  const storageService = appContainer.get<IStorageService>(SERVICE_TYPES.storageService);
  await storageService.startup();

  // 初始化WebApi
  const webApiService = appContainer.get<IWebApiService>(SERVICE_TYPES.webApiService);
  await webApiService.startup();

  // 初始化任务分派服务
  appContainer.get<ITaskDispatchService>(SERVICE_TYPES.taskDispatchService);

  // 初始化任务服务
  appContainer.get<ITaskService>(SERVICE_TYPES.taskService);
}

main()
  .then(() => {
    console.log('System startup');
  })
  .catch((err) => {
    console.error(`Unexpected exception:`, err);
    process.exit(1);
  });
