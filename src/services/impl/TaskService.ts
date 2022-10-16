import assert from 'assert';
import { injectable, inject } from 'inversify';
import { SERVICE_TYPES } from '../types';
import { ILoggingService, Logger } from '../abstract/ILoggingService';
import {
  IStorageService, SDTaskTypes, SDTex2ImgTaskParameters, SDImg2ImgTaskParameters, SDUpscaleTaskParameters, SDTaskDesc
} from '../abstract/IStorageService';
import { IWebApiService, webApiArg, WebApiArgFlags, WebApiArgTypes, webApiMethod } from '../abstract/IWebApiService';
import { ITaskService, TaskStateDesc } from '../abstract/ITaskService';
import { ITaskDispatchService } from '../abstract/ITaskDispatchService';
import { blobToBase64Array, base64ArrayToBlob } from '../../utils/ImageArrayBlob';


@injectable()
export class TaskService implements ITaskService {
  #logger: Logger;
  #storage: IStorageService;
  #dispatch: ITaskDispatchService;
  
  constructor(
    @inject(SERVICE_TYPES.loggingService) loggingService: ILoggingService,
    @inject(SERVICE_TYPES.storageService) storageService: IStorageService,
    @inject(SERVICE_TYPES.webApiService) webApiService: IWebApiService,
    @inject(SERVICE_TYPES.taskDispatchService) taskDispatchService: ITaskDispatchService)
  {
    this.#logger = loggingService.createLogger('TaskService');
    this.#storage = storageService;
    this.#dispatch = taskDispatchService;
    
    // 注册服务
    webApiService.register('Task', this);
  }

  @webApiMethod()
  async submitTxt2ImgTask(
    @webApiArg('width', WebApiArgTypes.double) width: number,
    @webApiArg('height', WebApiArgTypes.double) height: number,
    @webApiArg('prompts', WebApiArgTypes.str) prompts: string,
    @webApiArg('negativePrompts', WebApiArgTypes.str) negativePrompts: string,
    @webApiArg('count', WebApiArgTypes.double) count: number,
    @webApiArg('steps', WebApiArgTypes.double) steps: number,
    @webApiArg('scale', WebApiArgTypes.double) scale: number,
    @webApiArg('seed', WebApiArgTypes.double, WebApiArgFlags.optional) seed?: number,
    @webApiArg('module', WebApiArgTypes.str, WebApiArgFlags.optional) module?: string,
    @webApiArg('comment', WebApiArgTypes.str, WebApiArgFlags.optional) comment?: string)
      : Promise<number> {
    const para: SDTex2ImgTaskParameters = {
      width,
      height,
      prompts,
      negativePrompts,
      steps,
      scale,
      seed,
      module,
    };
    const ret = await this.#storage.createTask(SDTaskTypes.txt2img, para, count, undefined, comment);
    this.#dispatch.immediateCheck();
    return ret;
  }

  @webApiMethod()
  async submitImg2ImgTask(
    @webApiArg('width', WebApiArgTypes.double) width: number,
    @webApiArg('height', WebApiArgTypes.double) height: number,
    @webApiArg('initialImages', WebApiArgTypes.array) initialImages: string[],
    @webApiArg('prompts', WebApiArgTypes.str) prompts: string,
    @webApiArg('negativePrompts', WebApiArgTypes.str) negativePrompts: string,
    @webApiArg('steps', WebApiArgTypes.double) steps: number,
    @webApiArg('scale', WebApiArgTypes.double) scale: number,
    @webApiArg('denoise', WebApiArgTypes.double) denoise: number,
    @webApiArg('resizeMode', WebApiArgTypes.double) resizeMode: number,
    @webApiArg('seed', WebApiArgTypes.double, WebApiArgFlags.optional) seed?: number,
    @webApiArg('module', WebApiArgTypes.str, WebApiArgFlags.optional) module?: string,
    @webApiArg('comment', WebApiArgTypes.str, WebApiArgFlags.optional) comment?: string)
      : Promise<number> {
    const para: SDImg2ImgTaskParameters = {
      width,
      height,
      prompts,
      negativePrompts,
      steps,
      scale,
      denoise,
      resizeMode,
      seed,
      module,
    };
    const ret = await this.#storage.createTask(SDTaskTypes.img2img, para, initialImages.length, base64ArrayToBlob(initialImages), comment);
    this.#dispatch.immediateCheck();
    return ret;
  }

  @webApiMethod()
  async submitUpscaleTask(
    @webApiArg('image', WebApiArgTypes.str) image: string,
    @webApiArg('scale', WebApiArgTypes.double) scale: number,
    @webApiArg('comment', WebApiArgTypes.str, WebApiArgFlags.optional) comment?: string)
      : Promise<number> {
    const para: SDUpscaleTaskParameters = {
      scale,
    };
    const ret = await this.#storage.createTask(SDTaskTypes.upscale, para, 1, base64ArrayToBlob([image]), comment);
    this.#dispatch.immediateCheck();
    return ret;
  }

  @webApiMethod()
  async getTaskState(@webApiArg('taskId', WebApiArgTypes.double) taskId: number): Promise<TaskStateDesc | null> {
    const desc = await this.#storage.getTaskDesc(taskId);
    if (!desc)
      return null;
    return {
      id: desc.id,
      status: desc.status,
      type: desc.type,
      comment: desc.comment,
      errMsg: desc.errMsg,
      progress: desc.progress,
      resultImages: desc.resultImages ? blobToBase64Array(desc.resultImages) : null,
      resultSeed: desc.resultSeed,
      resultWidth: desc.resultWidth,
      resultHeight: desc.resultHeight,
    };
  }
}
