import assert from 'assert';
import zlib from 'zlib';
import Koa from 'koa';
import KoaJson from 'koa-json';
import KoaBodyParser from 'koa-bodyparser';
import KoaCompress from 'koa-compress';
import KoaRouter, { RouterContext } from '@koa/router';

import { injectable, inject } from 'inversify';
import { SERVICE_TYPES } from '../types';
import { IAppConfigService } from '../abstract/IAppConfigService';
import { ILoggingService, Logger } from '../abstract/ILoggingService';
import {
  IWebApiService,
  getWebApiMethodOptions,
  getWebApiArgOptions,
  WebApiErrorCodes,
  WebApiArgTypes,
  WebApiArgFlags,
  EventListenType
} from '../abstract/IWebApiService';


@injectable()
export class WebApiService implements IWebApiService {
  #config: IAppConfigService;
  #logger: Logger;
  #app: Koa;
  #router: KoaRouter;

  #events: Record<string, EventListenType[]> = {};  // 事件监听器

  constructor(@inject(SERVICE_TYPES.appConfigService) appConfigService: IAppConfigService,
    @inject(SERVICE_TYPES.loggingService) loggingService: ILoggingService) {
    this.#config = appConfigService;
    this.#logger = loggingService.createLogger('WebApiService');
    this.#app = new Koa();
    this.#router = new KoaRouter();
  }

  private emitEvent(name: string, arg: any) {
    const listeners = this.#events[name];
    if (listeners !== undefined) {
      for (const l of listeners) {
        try {
          l(arg);
        } catch (ex) {
          this.#logger.error(`Unhandled exception calling event ${name}: ${ex}`);
        }
      }
    }
  }

  async startup(): Promise<void> {
    this.#app.use(KoaBodyParser({jsonLimit: '50mb'}));
    this.#app.use(this.#router.routes());
    this.#app.use(this.#router.allowedMethods());
    this.#app.use(KoaJson());
    this.#app.use(KoaCompress({
      threshold: 4096,
      gzip: {
        flush: zlib.constants.Z_SYNC_FLUSH
      },
      deflate: {
        flush: zlib.constants.Z_SYNC_FLUSH,
      },
      br: false // disable brotli
    }));

    this.#logger.info(`Listen on ${this.#config.getWebApiListenHost()}:${this.#config.getWebApiListenPort()}`);
    this.#app.listen(this.#config.getWebApiListenPort(), this.#config.getWebApiListenHost());
  }

  register<T>(serviceName: string, handler: T): void {
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(handler))) {
      const method = (handler as any)[name];
      if (!(method instanceof Function) || method === handler)
        continue;

      const methodOpts = getWebApiMethodOptions(handler, name);
      if (methodOpts) {
        const argOpts = getWebApiArgOptions(handler, name);

        const callPath = serviceName === '' ? this.#config.getWebApiPrefix() + `/${methodOpts.alias}` :
          this.#config.getWebApiPrefix() + `/${serviceName}/${methodOpts.alias}`;
        this.#logger.info(`Register api handler: ${callPath}`);

        const processor = async (ctx) => {
          const requestBeginTime = Date.now();
          try {
            const reqBody = ctx.request.body;

            // 检查是否公开
            if (methodOpts.public !== true) {
              const reqHeader = ctx.request.header;
              // FIXME: time-safe comparsion is expected
              if (reqHeader['x-api-secret'] !== this.#config.getWebApiSecret()) {
                ctx.body = {
                  code: WebApiErrorCodes.authorizeError,
                  msg: `Authorize failed`,
                  data: null,
                };
                return;
              }
            }

            // 准备参数
            const callArgs: any[] = [];
            if (argOpts) {
              for (const argPos in argOpts) {
                const desc = argOpts[argPos];

                // 获取值
                let reqValue = reqBody[desc.alias];

                // 检查是否必须值
                if (undefined === reqValue || null === reqValue) {
                  if (desc.flags === WebApiArgFlags.required) {
                    this.#logger.error(`Request missing argument ${desc.alias}, path: ${callPath}`);
                    ctx.body = {
                      code: WebApiErrorCodes.missingArgument,
                      msg: `Missing argument ${desc.alias}`,
                      data: null,
                    };
                    return;
                  }
                } else {
                  // 类型检查
                  if (desc.type === WebApiArgTypes.bool && typeof reqValue !== 'boolean') {
                    this.#logger.error(`Request bad argument ${desc.alias}, path: ${callPath}`);
                    ctx.body = {
                      code: WebApiErrorCodes.badArgumentType,
                      msg: `Argument ${desc.alias} invalid type`,
                      data: null,
                    };
                    return;
                  } else if (desc.type === WebApiArgTypes.double && typeof reqValue !== 'number') {
                    this.#logger.error(`Bad argument ${desc.alias}, path: ${callPath}, found: ${typeof reqValue}`);
                    ctx.body = {
                      code: WebApiErrorCodes.badArgumentType,
                      msg: `Argument ${desc.alias} invalid type`,
                      data: null,
                    };
                    return;
                  } else if (desc.type === WebApiArgTypes.str && typeof reqValue !== 'string') {
                    this.#logger.error(`Request bad argument ${desc.alias}, path: ${callPath}`);
                    ctx.body = {
                      code: WebApiErrorCodes.badArgumentType,
                      msg: `Argument ${desc.alias} invalid type`,
                      data: null,
                    };
                    return;
                  } else if (desc.type === WebApiArgTypes.date) {
                    if (typeof reqValue !== 'number' && typeof reqValue !== 'string') {
                      this.#logger.error(`Request bad argument ${desc.alias}, path: ${callPath}`);
                      ctx.body = {
                        code: WebApiErrorCodes.badArgumentType,
                        msg: `Argument ${desc.alias} invalid type`,
                        data: null,
                      };
                      return;
                    } else {
                      reqValue = new Date(reqValue);
                    }
                  } else if (desc.type === WebApiArgTypes.object && typeof reqValue !== 'object') {
                    this.#logger.error(`Request bad argument ${desc.alias}, path: ${callPath}`);
                    ctx.body = {
                      code: WebApiErrorCodes.badArgumentType,
                      msg: `Argument ${desc.alias} invalid type`,
                      data: null,
                    };
                    return;
                  }
                }

                const argRequired = Math.max(0, parseInt(argPos, 10) + 1 - callArgs.length);
                for (let i = 0; i < argRequired; ++i)
                  callArgs.push(undefined);
                callArgs[argPos] = reqValue;
              }
            }

            // 执行
            let ret = ((handler as any)[name] as (...args: any[]) => Promise<any> | any).apply(handler, callArgs);
            if (ret instanceof Promise)
              ret = await ret;

            // 回包
            if (methodOpts.plain) {
              if (typeof(ret) === 'string')
                ctx.body = ret;
              else if (ret === undefined)
                ctx.body = '';
              else
                ctx.body = JSON.stringify(ret);
              this.emitEvent('request', { name, code: WebApiErrorCodes.ok, msg: 'ok', elapsed: Date.now() - requestBeginTime });
            } else {
              if (ret === undefined)
                ret = null;
              ctx.body = {
                code: WebApiErrorCodes.ok,
                msg: 'ok',
                data: ret,
              };
              this.emitEvent('request', { name, code: ctx.body.code, msg: ctx.body.msg, elapsed: Date.now() - requestBeginTime });
            }
          } catch (ex) {
            this.#logger.error(`Request internal error, path: ${callPath}`, ex);
            if (methodOpts.plain) {
              ctx.body = '';
              ctx.status = 500;
              this.emitEvent('request', { name, code: WebApiErrorCodes.internalError, msg: '${ex}', elapsed: Date.now() - requestBeginTime });
            } else {
              ctx.body = {
                code: WebApiErrorCodes.internalError,
                msg: `${ex}`,
                data: null,
              };
              this.emitEvent('request', { name, code: ctx.body.code, msg: ctx.body.msg, elapsed: Date.now() - requestBeginTime });
            }
          }
        };

        if (methodOpts.get)
          this.#router.get(callPath, processor);
        else
          this.#router.post(callPath, processor);
      }
    }
  }

  listenEvent(event: string, handler: EventListenType): void {
    if (this.#events[event] === undefined)
      this.#events[event] = [];
    this.#events[event].push(handler);
  }
}
