import { readFile } from 'fs';
import { promisify } from 'util';
import { injectable } from 'inversify';
import { IAppConfigService } from '../abstract/IAppConfigService';


const readFileAsync = promisify(readFile);

interface ConfigDesc {
  webApiListenHost: string;
  webApiListenPort: number;
  webApiPrefix: string;
  webApiSecret: string;
  storageDBUrl: string;
}

const kDefaultConfig: ConfigDesc = {
  webApiListenHost: '0.0.0.0',
  webApiListenPort: 17059,
  webApiPrefix: '/api',
  webApiSecret: 'qwert12345',
  storageDBUrl: 'sqlite::memory:',
};

@injectable()
export class AppConfigService implements IAppConfigService {
  #config: ConfigDesc = kDefaultConfig;

  async loadFromJsonFile(filename: string): Promise<void> {
    const data = await readFileAsync(filename, { encoding: 'utf-8' });
    const cfg = JSON.parse(data);
    this.#config = { ...kDefaultConfig, ...cfg };
  }

  getWebApiListenHost(): string {
    return this.#config.webApiListenHost;
  }

  getWebApiListenPort(): number {
    return this.#config.webApiListenPort;
  }

  getWebApiPrefix(): string {
    return this.#config.webApiPrefix;
  }

  getWebApiSecret(): string {
    return this.#config.webApiSecret;
  }

  getStorageDBUrl(): string {
    return this.#config.storageDBUrl;
  }
}
