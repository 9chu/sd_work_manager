import log4js from 'log4js';


export type Logger = log4js.Logger;

/**
 * 日志服务
 */
export interface ILoggingService {
  /**
   * 创建日志器
   * @param category 分类
   */
  createLogger(category: string): Logger;
}
