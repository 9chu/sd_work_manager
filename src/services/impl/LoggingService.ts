import { injectable } from 'inversify';
import log4js from 'log4js';
import { ILoggingService, Logger } from '../abstract/ILoggingService';


@injectable()
export class LoggingService implements ILoggingService {
  createLogger(category: string): Logger {
    const logger = log4js.getLogger(category);
    logger.level = 'debug';
    return logger;
  }
}
