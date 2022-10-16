/**
 * 应用程序配置服务
 */
export interface IAppConfigService {
  /**
   * 从JSON文件加载
   * @param filename 文件名
   */
  loadFromJsonFile(filename: string): Promise<void>;

  // 配置项

  /**
   * WebApi 监听地址
   */
  getWebApiListenHost(): string;

  /**
   * WebApi 监听端口
   */
  getWebApiListenPort(): number;

  /**
   * WebApi 前缀
   */
  getWebApiPrefix(): string;

  /**
   * WebApi API 密钥
   */
  getWebApiSecret(): string;

  /**
   * 获取存储数据库地址
   */
  getStorageDBUrl(): string;
}
