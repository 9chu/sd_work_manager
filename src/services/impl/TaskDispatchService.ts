import assert from 'assert';
import { Context } from 'koa';
import { injectable, inject } from 'inversify';
import { SERVICE_TYPES } from '../types';
import { ILoggingService, Logger } from '../abstract/ILoggingService';
import { IAppConfigService } from '../abstract/IAppConfigService';
import { ITimerService } from '../abstract/ITimerService';
import {
  IStorageService, SDTaskTypes, SDTex2ImgTaskParameters, SDImg2ImgTaskParameters, SDUpscaleTaskParameters
} from '../abstract/IStorageService';
import { IWebApiService, webApiArg, WebApiArgFlags, WebApiArgTypes, webApiMethod } from '../abstract/IWebApiService';
import {
  ITaskDispatchService, TaskPullResponse, TaskStatus, TaskProcessingResult, TaskUpscaleResult
} from '../abstract/ITaskDispatchService';
import { blobToBase64Array, base64ArrayToBlob } from '../../utils/ImageArrayBlob';


interface QueuedWorker {
  context: Context;
  incomingTime: number;
  resolve: (resp: TaskPullResponse) => void;
}

const kTaskPullTimeout = 250;  // 客户端 Pull 操作超时是 300 秒，这里宽裕到 250 秒
const kCheckDbInterval = 5;  // 每 5 秒检查一下 DB
const kPendingTaskTimeout = 1 * 3600;  // 任务等待不超过 1 小时
const kRunningTaskTimeout = 10 * 60;  // 任务运行不超过 10 分钟

@injectable()
export class TaskDispatchService implements ITaskDispatchService {
  #logger: Logger;
  #config: IAppConfigService;
  #storage: IStorageService;

  #lastCheckDbTime = 0;
  #workers: QueuedWorker[] = [];

  constructor(
    @inject(SERVICE_TYPES.loggingService) loggingService: ILoggingService,
    @inject(SERVICE_TYPES.appConfigService) appConfigService: IAppConfigService,
    @inject(SERVICE_TYPES.timerService) timerService: ITimerService,
    @inject(SERVICE_TYPES.storageService) storageService: IStorageService,
    @inject(SERVICE_TYPES.webApiService) webApiService: IWebApiService)
  {
    this.#logger = loggingService.createLogger('TaskDispatchService');
    this.#config = appConfigService;
    this.#storage = storageService;

    // 注册服务
    webApiService.register('TaskDispatch', this);

    // 注册定时器
    timerService.schedule(1000, (now) => this.onTick(now));
  }

  private popWorker(): QueuedWorker | undefined {
    if (this.#workers.length === 0)
      return undefined;

    // 总是获取一个时间最长的 worker
    let bestIndex = 0;
    let bestWorkerTime: number;
    for (let i = 0; i < this.#workers.length; ++i) {
      const w = this.#workers[i];
      if (bestWorkerTime === undefined || w.incomingTime < bestWorkerTime) {
        bestIndex = i;
        bestWorkerTime = w.incomingTime;
      }
    }
    const ret = this.#workers[bestIndex];
    this.#workers.splice(bestIndex, 1);
    return ret;
  }

  private async onTick(now: number): Promise<void> {
    // 检查即将超时的 Task
    for (let i = 0; i < this.#workers.length; ) {
      const w = this.#workers[i];
      if (now - w.incomingTime > kTaskPullTimeout * 1000) {
        try {
          w.resolve({
            type: 'none',
          });
        } catch (ex) {
          this.#logger.error(`Unexpected exception handling task: ${ex}`);
        }
        this.#workers.splice(i, 1);
        continue;
      }
      ++i;
    }

    // 去 DB 查一下有没有任务需要分派
    if (this.#workers.length > 0 && now - this.#lastCheckDbTime > kCheckDbInterval * 1000) {
      this.#lastCheckDbTime = now;

      // 获取所有超时的任务
      const timeoutTasks = await this.#storage.fetchTimeoutedTasks(kPendingTaskTimeout * 1000, kRunningTaskTimeout * 1000);
      for (const t of timeoutTasks) {
        this.#logger.error(`Task ${t} is timeouted`);
        await this.#storage.setTaskError(t, 'timeout');
      }

      // 获取所有等待的任务
      const pendingTasks = await this.#storage.fetchPendingTasks(this.#workers.length);

      // 分派任务
      for (const t of pendingTasks) {
        // 取得一个 worker
        const w = this.popWorker();
        assert(w !== undefined);

        try {
          const resp: TaskPullResponse = {
            type: 'none',
            taskId: t.id,
          };

          switch (t.type) {
            case SDTaskTypes.txt2img:
              resp.type = 'tex2img';
              resp.parameters = {
                width: (t.parameters as SDTex2ImgTaskParameters).width,
                height: (t.parameters as SDTex2ImgTaskParameters).height,
                prompts: (t.parameters as SDTex2ImgTaskParameters).prompts,
                negativePrompts: (t.parameters as SDTex2ImgTaskParameters).negativePrompts,
                count: t.count,
                steps: (t.parameters as SDTex2ImgTaskParameters).steps,
                scale: (t.parameters as SDTex2ImgTaskParameters).scale,
                seed: (t.parameters as SDTex2ImgTaskParameters).seed,
                module: (t.parameters as SDTex2ImgTaskParameters).module,
              };
              break;
            case SDTaskTypes.img2img:
              resp.type = 'img2img';
              resp.parameters = {
                width: (t.parameters as SDImg2ImgTaskParameters).width,
                height: (t.parameters as SDImg2ImgTaskParameters).height,
                initialImages: blobToBase64Array(t.initialImages),
                prompts: (t.parameters as SDImg2ImgTaskParameters).prompts,
                negativePrompts: (t.parameters as SDImg2ImgTaskParameters).negativePrompts,
                steps: (t.parameters as SDImg2ImgTaskParameters).steps,
                scale: (t.parameters as SDImg2ImgTaskParameters).scale,
                denoise: (t.parameters as SDImg2ImgTaskParameters).denoise,
                resizeMode: (t.parameters as SDImg2ImgTaskParameters).resizeMode,
                seed: (t.parameters as SDImg2ImgTaskParameters).seed,
                module: (t.parameters as SDImg2ImgTaskParameters).module,
              };
              break;
            case SDTaskTypes.upscale:
              resp.type = 'upscale';
              resp.parameters = {
                image: blobToBase64Array(t.initialImages)[0],
                scale: (t.parameters as SDUpscaleTaskParameters).scale,
              };
              break;
            default:
              assert(false);
              break;
          }

          // 提交给任务
          w.resolve(resp);
        } catch (ex) {
          this.#logger.error(`Unexpected exception handling task: ${ex}`);

          // 写 DB 失败
          await this.#storage.setTaskError(t.id, `${ex}`);
          continue;
        }

        // 刷新 DB 状态
        await this.#storage.setTaskRunning(t.id);
      }
    }
  }

  private onPullTaskClosed(context: Context) {
    for (let i = 0; i < this.#workers.length; ++i) {
      const w = this.#workers[i];
      if (w.context === context) {
        this.#workers.splice(i, 1);
        this.#logger.error(`Pulling worker is closed, remote=${context.req.socket.remoteAddress}`);
        break;
      }
    }
  }

  @webApiMethod()
  pullTask(@webApiArg('_', WebApiArgTypes.bindContext) context: Context): Promise<TaskPullResponse> {
    context.res.once("close", () => this.onPullTaskClosed(context));

    return new Promise<TaskPullResponse>((resolve) => {
      const w: QueuedWorker = {
        context,
        incomingTime: Date.now(),
        resolve,
      };
      this.#workers.push(w);
    });
  }

  @webApiMethod()
  async updateTask(
    @webApiArg('taskId', WebApiArgTypes.double) taskId: number,
    @webApiArg('status', WebApiArgTypes.double) status: TaskStatus,
    @webApiArg('errorMsg', WebApiArgTypes.str, WebApiArgFlags.optional) errorMsg?: string,
    @webApiArg('progress', WebApiArgTypes.double, WebApiArgFlags.optional) progress?: number,
    @webApiArg('result', WebApiArgTypes.object, WebApiArgFlags.optional) result?: TaskProcessingResult | TaskUpscaleResult)
      : Promise<void> {
    if (status === TaskStatus.error) {
      assert(errorMsg !== undefined);
      await this.#storage.setTaskError(taskId, errorMsg);
    } else if (status == TaskStatus.running) {
      assert(progress !== undefined);
      await this.#storage.updateTaskProgress(taskId, progress);
    } else if (status === TaskStatus.finished) {
      assert(result !== undefined);
      await this.#storage.setTaskFinished(
        taskId,
        'images' in result ? base64ArrayToBlob(result.images) : ('image' in result ? base64ArrayToBlob([result.image]) : undefined),
        'seed' in result ? result.seed : undefined,
        result.width,
        result.height);
    }
  }

  immediateCheck(): void {
    this.#lastCheckDbTime = 0;
  }
}
