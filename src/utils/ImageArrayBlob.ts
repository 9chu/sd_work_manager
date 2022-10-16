export const base64ArrayToBlob = (b64: string[]): Buffer => {
  let ret: Buffer = Buffer.alloc(8);
  ret.writeUInt32LE(0, 0);  // version
  ret.writeUInt32LE(b64.length, 4);  // count

  for (const b of b64) {
    const buf = Buffer.from(b, 'base64');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buf.length, 0);  // length
    ret = Buffer.concat([ret, header, buf]);
  }
  return ret;
};

export const blobToBase64Array = (buf: Buffer): string[] => {
  let ret: string[] = [];
  const version = buf.readInt32LE(0);
  if (version !== 0)
    throw new Error(`Unexpected version ${version}`);
  const count = buf.readInt32LE(4);
  let offset = 8;
  for (let i = 0; i < count; ++i) {
    const len = buf.readUInt32LE(offset);
    const binary = buf.slice(offset + 4, offset + 4 + len);
    ret.push(binary.toString('base64'));
    offset += 4 + len;
  }
  return ret;
};
