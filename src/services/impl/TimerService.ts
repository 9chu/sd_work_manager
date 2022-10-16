import assert from 'assert';

import { injectable, inject } from 'inversify';
import { SERVICE_TYPES } from '../types';
import { ILoggingService, Logger } from '../abstract/ILoggingService';
import { ITimerService, TimerCallback } from '../abstract/ITimerService';

import { IntrusiveHeapNode, IntrusiveHeap } from '../../utils/IntrusiveHeap';


const TICK_INTERVAL = 100;

interface TimerNode extends IntrusiveHeapNode {
  next: number,
  interval: number,
  callback: TimerCallback,
}

@injectable()
export class TimerService implements ITimerService {
  #logger: Logger;
  //#timer: NodeJS.Timeout;
  #heap: IntrusiveHeap<TimerNode>;

  constructor(@inject(SERVICE_TYPES.loggingService) loggingService: ILoggingService) {
    this.#logger = loggingService.createLogger('TimerService');
    /*this.#timer =*/ setInterval(() => {
      this.tick(Date.now());
    }, TICK_INTERVAL);
    this.#heap = new IntrusiveHeap((a: TimerNode, b: TimerNode) => {
      return a.next < b.next;
    });
  }

  private tick(now: number): void {
    while (!this.#heap.empty()) {
      const top = this.#heap.top();
      assert(top);

      if (top.next <= now) {
        this.#heap.dequeue();

        let ret;
        try {
          ret = top.callback(now);
        } catch (ex) {
          this.#logger.error(`Unexpected exception call task:`, ex);
        }

        if (ret instanceof Promise) {
          ret.then(() => {
            this.reschedule(top);
          })
          .catch((err) => {
            this.#logger.error(`Unexpected exception call task:`, err);
            this.reschedule(top);
          });
        } else {
          this.reschedule(top);
        }
      } else {
        break;
      }
    }
  }

  private reschedule(node: TimerNode): void {
    node.next = Date.now() + Math.max(1, node.interval);
    this.#heap.insert(node);
  }

  schedule(interval: number, callback: TimerCallback): void {
    const node: TimerNode = {
      parent: null,
      left: null,
      right: null,

      next: 0,
      interval,
      callback,
    };
    this.reschedule(node);
  }
}
