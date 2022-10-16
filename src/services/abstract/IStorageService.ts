/**
 * 任务状态
 */
export enum SDTaskStatus {
  pending = 0,
  running = 1,
  finished = 2,
  error = 3,
}

/**
 * 任务类型
 */
export enum SDTaskTypes {
  txt2img = 0,
  img2img = 1,
  upscale = 2,
}

export interface SDTex2ImgTaskParameters {
  width: number;
  height: number;
  prompts: string;
  negativePrompts: string;
  steps: number;
  scale: number;
  seed?: number;
  module?: string;
}

export interface SDImg2ImgTaskParameters {
  width: number;
  height: number;
  prompts: string;
  negativePrompts: string;
  steps: number;
  scale: number;
  denoise: number;
  resizeMode: number;
  seed?: number;
  module?: string;
}

export interface SDUpscaleTaskParameters {
  scale: number;
}

export type SDTaskParameters = SDTex2ImgTaskParameters | SDImg2ImgTaskParameters | SDUpscaleTaskParameters;

export interface SDTaskDesc {
  id: number;
  status: SDTaskStatus;
  type: SDTaskTypes;
  parameters: SDTaskParameters;
  count: number;
  initialImages: Buffer | null;
  resultImages: Buffer | null;
  resultSeed: number | null;
  resultWidth: number | null;
  resultHeight: number | null;
  comment: string | null;
  errMsg: string | null;
  commitAt: Date;
  workerStartAt: Date;
  workerFinishAt: Date;
  workerLastUpdateAt: Date;
  progress: number | null;
}

/**
 * DB落地服务
 */
export interface IStorageService {
  /**
   * 启动
   */
  startup(): Promise<void>;

  /**
   * 获取等待的任务
   * @param limit 限制任务个数
   */
  fetchPendingTasks(limit: number): Promise<SDTaskDesc[]>;

  /**
   * 获取所有超时的任务
   * @param pendingTimeout Pending 状态的超时时间
   * @param runningTimeout Running 状态的超时时间
   */
  fetchTimeoutedTasks(pendingTimeout: number, runningTimeout: number): Promise<number[]>;

  /**
   * 设置任务运行状态
   * @param taskId 任务ID
   */
  setTaskRunning(taskId: number): Promise<void>;

  /**
   * 设置任务错误状态
   * @param taskId 任务ID
   * @param msg 消息
   */
  setTaskError(taskId: number, msg: string): Promise<void>;

  /**
   * 设置任务完成状态
   * @param taskId 任务ID
   * @param images 编码后的图像数组
   * @param seed 种子
   * @param width 宽度
   * @param height 高度
   */
  setTaskFinished(taskId: number, images?: Buffer, seed?: number, width?: number, height?: number): Promise<void>;

  /**
   * 更新任务进度
   * @param taskId 任务ID
   * @param progress 进度
   */
  updateTaskProgress(taskId: number, progress: number): Promise<void>;

  /**
   * 创建任务
   * @param type 任务类型
   * @param parameters 参数
   * @param count 数量
   * @param initialImages 初始图片数
   * @param comment 评论
   */
  createTask(type: SDTaskTypes, parameters: SDTaskParameters, count: number, initialImages?: Buffer, comment?: string): Promise<number>;

  /**
   * 获取任务描述
   * @param id 任务ID
   */
  getTaskDesc(id: number): Promise<SDTaskDesc | null>;
}
