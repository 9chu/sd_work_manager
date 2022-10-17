import assert from 'assert';
import {
  Sequelize,
  Optional,
  Model,
  ModelStatic,
  DataTypes,
  Transaction,
  Op
} from 'sequelize';
import moment from 'moment';
import { injectable, inject } from 'inversify';
import { SERVICE_TYPES } from '../types';
import { ILoggingService, Logger } from '../abstract/ILoggingService';
import { IAppConfigService } from '../abstract/IAppConfigService';
import { IStorageService, SDTaskStatus, SDTaskTypes, SDTaskParameters, SDTaskDesc } from '../abstract/IStorageService';


// #region SDTask

interface SDTaskAttributes {
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

interface SDTaskCreationAttributes extends Optional<SDTaskAttributes, "id"> {}

interface SDTaskModel extends Model<SDTaskAttributes, SDTaskCreationAttributes>, SDTaskAttributes {}

// #endregion

const toTaskDesc = (record: SDTaskModel): SDTaskDesc => {
  return {
    id: record.id,
    status: record.status,
    type: record.type,
    parameters: record.parameters,
    count: record.count,
    initialImages: record.initialImages,
    resultImages: record.resultImages,
    resultSeed: record.resultSeed,
    resultWidth: record.resultWidth,
    resultHeight: record.resultHeight,
    comment: record.comment,
    errMsg: record.errMsg,
    commitAt: record.commitAt,
    workerStartAt: record.workerStartAt,
    workerFinishAt: record.workerFinishAt,
    workerLastUpdateAt: record.workerLastUpdateAt,
    progress: record.progress,
  };
};

@injectable()
export class StorageService implements IStorageService {
  #logger: Logger;
  #sequelize: Sequelize;

  #sdTaskModel?: ModelStatic<SDTaskModel>;

  constructor(
    @inject(SERVICE_TYPES.loggingService) loggingService: ILoggingService,
    @inject(SERVICE_TYPES.appConfigService) appConfigService: IAppConfigService)
  {
    this.#logger = loggingService.createLogger('StorageService');
    this.#sequelize = new Sequelize(appConfigService.getStorageDBUrl(), {
      logging: (sql: string, timing?: number) => { /* this.#logger.debug(sql) */ },
      define: {
        freezeTableName: true,
      },
    });
  }

  async startup(): Promise<void> {
    await this.#sequelize.authenticate();
    this.#logger.info(`Connection established`);

    // 建立数据模型
    this.#sdTaskModel = this.#sequelize.define<SDTaskModel>('SDTask', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      status: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      parameters: {
        type: DataTypes.TEXT,
        allowNull: false,
        get(): SDTaskParameters {
          const val = this.getDataValue('parameters') as unknown as string;
          if (val === undefined)
            return undefined;
          return JSON.parse(val) as SDTaskParameters;
        },
        set(value: SDTaskParameters) {
          const ret = JSON.stringify(value);
          this.setDataValue('parameters', ret as unknown as SDTaskParameters);
        }
      },
      count: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      initialImages: {
        type: DataTypes.BLOB,
        allowNull: true,
      },
      resultImages: {
        type: DataTypes.BLOB,
        allowNull: true,
      },
      resultSeed: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      },
      resultWidth: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      resultHeight: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      errMsg: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      commitAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(0),
      },
      workerStartAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(0),
      },
      workerFinishAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(0),
      },
      workerLastUpdateAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: new Date(0),
      },
      progress: {
        type: DataTypes.DOUBLE,
        allowNull: true,
      }
    }, {
      indexes: [{
        unique: false,
        fields: ['status']
      }]
    });
    await this.#sdTaskModel.sync({ alter: true });
  }

  async fetchPendingTasks(limit: number): Promise<SDTaskDesc[]> {
    const records = await this.#sdTaskModel.findAll({
      where: {
        status: SDTaskStatus.pending
      },
      limit
    });
    const ret: SDTaskDesc[] = [];
    for (const r of records)
      ret.push(toTaskDesc(r));
    return ret;
  }

  async fetchTimeoutedTasks(pendingTimeout: number, runningTimeout: number): Promise<number[]> {
    const expectedCommitAfter = new Date(Date.now() - pendingTimeout);
    const expectedFinishedBefore = new Date(Date.now() - runningTimeout);

    const pendingTimeoutRecords = await this.#sdTaskModel.findAll({
      where: {
        status: SDTaskStatus.pending,
        commitAt: {
          [Op.lte]: expectedCommitAfter,  // 早于超时时间之前还没有启动的任务
        }
      },
    });
    const runningTimeoutRecords = await this.#sdTaskModel.findAll({
      where: {
        status: SDTaskStatus.running,
        // workerStartAt: {
        workerLastUpdateAt: {  // 用更新时间代替开始时间，使得我们支持长时间任务
          [Op.lte]: expectedFinishedBefore,  // 在规定时间到达前没有完成的任务
        }
      },
    });
    const ret: number[] = [];
    for (const r of pendingTimeoutRecords)
      ret.push(r.id);
    for (const r of runningTimeoutRecords)
      ret.push(r.id);
    return ret;
  }

  async setTaskRunning(taskId: number): Promise<void> {
    const [cnt] = await this.#sdTaskModel.update({
        status: SDTaskStatus.running,
        workerStartAt: new Date(),
        workerLastUpdateAt: new Date(),
      }, {
        where: {
          status: SDTaskStatus.pending,
          id: taskId,
        }
      });
    if (cnt === 0)
      throw new Error(`Task state is already changed`);
  }

  async setTaskError(taskId: number, msg: string): Promise<void> {
    const [cnt] = await this.#sdTaskModel.update({
        status: SDTaskStatus.error,
        errMsg: msg.length > 250 ? msg.slice(0, 250) : msg,
        workerFinishAt: new Date(),
      }, {
        where: {
          status: {
            [Op.notIn]: [SDTaskStatus.error, SDTaskStatus.finished]
          },
          id: taskId,
        }
      });
    if (cnt === 0)
      throw new Error(`Task state is already changed`);
  }

  async setTaskFinished(taskId: number, images?: Buffer, seed?: number, width?: number, height?: number): Promise<void> {
    const [cnt] = await this.#sdTaskModel.update({
        status: SDTaskStatus.finished,
        resultImages: images === undefined ? null : images,
        resultSeed: seed === undefined ? null : seed,
        resultWidth: width === undefined ? null : width,
        resultHeight: height === undefined ? null : height,
        workerFinishAt: new Date(),
        workerLastUpdateAt: new Date(),
      }, {
        where: {
          status: SDTaskStatus.running,
          id: taskId,
        }
      });
    if (cnt === 0)
      throw new Error(`Task is not found or state already changed`);
  }

  async updateTaskProgress(taskId: number, progress: number): Promise<void> {
    const [cnt] = await this.#sdTaskModel.update({
        progress,
        workerLastUpdateAt: new Date(),
      }, {
        where: {
          status: SDTaskStatus.running,
          id: taskId,
        }
      });
    if (cnt === 0)
      throw new Error(`Task is not found or state already changed`);
  }

  async createTask(type: SDTaskTypes, parameters: SDTaskParameters, count: number, initialImages?: Buffer, comment?: string)
    : Promise<number> {
    const t = await this.#sdTaskModel.create({
      status: SDTaskStatus.pending,
      type,
      parameters,
      count,
      initialImages: initialImages === undefined ? null : initialImages,
      resultImages: null,
      resultSeed: null,
      resultWidth: null,
      resultHeight: null,
      comment: comment === undefined ? null : comment,
      errMsg: null,
      commitAt: new Date(),
      workerStartAt: new Date(0),
      workerFinishAt: new Date(0),
      workerLastUpdateAt: new Date(),
      progress: null,
    });
    return t.id;
  }

  async getTaskDesc(id: number): Promise<SDTaskDesc | null> {
    const record = await this.#sdTaskModel.findOne({
      where: {
        id,
      }
    });
    if (!record)
      return null;
    return toTaskDesc(record);
  }
}
