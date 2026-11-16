import { crc32 } from 'node:zlib';

// 1980-01-01, the earliest date a zip file can store
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * Builds a zip archive with uncompressed ("stored") entries: just enough
 * to hand a budget to the client, which unzips it with fflate. Written
 * out by hand so the tests don't need a zip library as a dependency.
 */
export function zipStored(files: Record<string, Uint8Array>): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, data] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, 'utf8');
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // compression: stored
    local.writeUInt16LE(0, 10); // modification time
    local.writeUInt16LE(DOS_DATE, 12); // modification date
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed to extract
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // compression: stored
    central.writeUInt16LE(0, 12); // modification time
    central.writeUInt16LE(DOS_DATE, 14); // modification date
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20); // compressed size
    central.writeUInt32LE(data.length, 24); // uncompressed size
    central.writeUInt16LE(nameBytes.length, 28);
    // extra length, comment length, disk number, internal and external
    // attributes stay 0
    central.writeUInt32LE(offset, 42); // offset of the local header

    localParts.push(local, nameBytes, Buffer.from(data));
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const count = Object.keys(files).length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(count, 8); // entries on this disk
  end.writeUInt16LE(count, 10); // total entries
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16); // offset of the central directory

  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}
