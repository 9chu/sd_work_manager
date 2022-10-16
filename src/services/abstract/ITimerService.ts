export type TimerCallback = (now: number) => Promise<void> | void;

/**
 * 定时器服务
 */
export interface ITimerService {
  /**
   * 加入定时器
   * @param interval 间隔（毫秒）
   * @param callback 回调函数
   */
  schedule(interval: number, callback: TimerCallback): void;
}
