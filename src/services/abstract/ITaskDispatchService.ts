import { Context } from 'koa';

export interface Tex2ImgParameters {
  width: number;
  height: number;
  prompts: string;
  negativePrompts: string;
  count: number;
  steps: number;
  scale: number;
  seed?: number;
  module?: string;
}

export interface Img2ImgParameters {
  width: number;
  height: number;
  initialImages: string[];
  prompts: string;
  negativePrompts: string;
  steps: number;
  scale: number;
  denoise: number;
  resizeMode: number;
  seed?: number;
  module?: string;
}

export interface UpscaleParameters {
  image: string;
  scale: number;
}

export interface TaskPullResponse {
  type: 'none' | 'tex2img' | 'img2img' | 'upscale';
  taskId?: number;
  parameters?: Tex2ImgParameters | Img2ImgParameters | UpscaleParameters;
}

export enum TaskStatus {
  running = 0,
  finished = 1,
  error = 2,
}

export enum SamplerTypes {
  ddim = 1,
  plms = 2,
}

export interface TaskProcessingResult {
  images: string[];
  width: number;
  height: number;
  seed: number;
  prompt: string;
  negativePrompt: string;
  samplerType: SamplerTypes;
}

export interface TaskUpscaleResult {
  image: string;
  width: number;
  height: number;
  scale: number;
}

/**
 * 任务分派服务
 */
export interface ITaskDispatchService {
  /**
   * 拉取任务
   */
  pullTask(context: Context): Promise<TaskPullResponse>;

  /**
   * 更新任务状态
   */
  updateTask(taskId: number, status: TaskStatus, errorMsg?: string, progress?: number, result?: TaskProcessingResult | TaskUpscaleResult): Promise<void>;

  /**
   * 立即进行检查
   */
  immediateCheck(): void;
}
