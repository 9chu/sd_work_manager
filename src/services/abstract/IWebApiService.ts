import 'reflect-metadata';


const kWebApiMethodSymbol = Symbol('webApiMethod');
const kWebApiArgSymbol = Symbol('webApiArg');

export enum WebApiErrorCodes {
  ok = 0,
  missingArgument = -100,
  badArgumentType = -101,
  internalError = -102,
  authorizeError = -103,
}

export interface WebApiMethodOptions {
  alias: string;
  get?: boolean;
  plain?: boolean;
  public?: boolean;
}

export enum WebApiArgTypes {
  bool,
  double,
  str,
  date,
  array,
  object,
  bindContext,
}

export enum WebApiArgFlags {
  required,
  optional,
}

export interface WebApiArgumentOptions {
  type: WebApiArgTypes;
  alias: string;
  flags: WebApiArgFlags;
}

export const webApiMethod = (get?: boolean, plain?: boolean, pub?: boolean) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor): void => {
    const opts: WebApiMethodOptions = {
      alias: propertyKey,
      get,
      plain,
      public: pub,
    };
    Reflect.defineMetadata(kWebApiMethodSymbol, opts, target, propertyKey);
  };
};

export const getWebApiMethodOptions = (target: any, propertyKey: string): WebApiMethodOptions | null => {
  const meta = Reflect.getMetadata(kWebApiMethodSymbol, target, propertyKey);
  if (!meta)
    return null;
  return meta as WebApiMethodOptions;
};

export const webApiArg = (alias: string, type: WebApiArgTypes, flags?: WebApiArgFlags) => {
  return (target: any, propertyKey: string, parameterIndex: number): void => {
    const opts: WebApiArgumentOptions = {
      alias,
      type,
      flags: flags ?? WebApiArgFlags.required,
    };

    let argDeclare: Record<number, WebApiArgumentOptions> | null = Reflect.getMetadata(kWebApiArgSymbol, target, propertyKey);
    if (!argDeclare)
      Reflect.defineMetadata(kWebApiArgSymbol, argDeclare = [], target, propertyKey);

    argDeclare[parameterIndex] = opts;
  };
};

export const getWebApiArgOptions = (target: any, propertyKey: string): Record<number, WebApiArgumentOptions> | null => {
  const meta = Reflect.getMetadata(kWebApiArgSymbol, target, propertyKey);
  if (!meta)
    return null;
  return meta as Record<number, WebApiArgumentOptions>;
};

export type EventListenType = (arg: any) => void;

export interface IWebApiService {
  /**
   * 启动服务
   */
  startup(): Promise<void>;

  /**
   * 注册服务
   * @param serviceName 服务名
   * @param handler 处理对象
   */
  register<T>(serviceName: string, handler: T): void;

  /**
   *
   * @param event 事件
   * @param handler 句柄
   */
  listenEvent(event: string, handler: EventListenType): void;
}
