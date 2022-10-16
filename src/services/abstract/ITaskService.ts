import { SDTaskStatus, SDTaskTypes } from "./IStorageService";

export interface TaskStateDesc {
  id: number;
  status: SDTaskStatus;
  type: SDTaskTypes;
  comment: string | null;
  errMsg: string | null;
  progress: number | null;
  resultImages: string[] | null;
  resultSeed: number | null;
  resultWidth: number | null;
  resultHeight: number | null;
}

/**
 * 任务服务
 */
export interface ITaskService {
  /**
   * 提交文本转图片任务
   * @param width 宽度
   * @param height 高度
   * @param prompts 关键词
   * @param negativePrompts 负面关键词
   * @param count 转换个数
   * @param steps 步长
   * @param scale CFG Scale
   * @param seed 种子
   * @param module hypernetwork
   * @param comment 备注
   */
  submitTxt2ImgTask(
    width: number,
    height: number,
    prompts: string,
    negativePrompts: string,
    count: number,
    steps: number,
    scale: number,
    seed?: number,
    module?: string,
    comment?: string): Promise<number>;

  /**
   * 提交图片转图片任务
   * @param width 宽度
   * @param height 高度
   * @param initialImages 初始图片(BASE64)
   * @param prompts 关键词
   * @param negativePrompts 负面关键词
   * @param steps 步长
   * @param scale CFG Scale
   * @param denoise 去噪系数
   * @param resizeMode 缩放模式
   * @param seed 种子
   * @param module hypernetwork
   * @param comment 备注
   */
  submitImg2ImgTask(
    width: number,
    height: number,
    initialImages: string[],
    prompts: string,
    negativePrompts: string,
    steps: number,
    scale: number,
    denoise: number,
    resizeMode: number,
    seed?: number,
    module?: string,
    comment?: string): Promise<number>;

  /**
   * 提交升采样任务
   * @param image 输入图片(BASE64)
   * @param scale 缩放系数
   * @param comment 备注
   */
  submitUpscaleTask(
    image: string,
    scale: number,
    comment?: string): Promise<number>;

  /**
   * 获取任务状态
   * @param taskId 任务ID
   */
  getTaskState(taskId: number): Promise<TaskStateDesc | null>;
}
