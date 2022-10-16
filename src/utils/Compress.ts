import { deflate, inflate } from 'zlib';


/**
 * 执行压缩
 * @param buf 输入缓冲区
 * @returns 压缩后数据
 */
export const compressBuffer = (buf: Buffer) => {
  return new Promise<Buffer>((resolve, reject) => {
    deflate(buf, (error: Error, result: Buffer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
};

/**
 * 执行解压
 * @param buf 输入缓冲区
 * @returns 压缩后数据
 */
export const decompressBuffer = (buf: Buffer) => {
  return new Promise<Buffer>((resolve, reject) => {
    inflate(buf, (error: Error, result: Buffer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
};
