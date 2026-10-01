// Minimal zip writer (stored entries) and reader (stored and deflated entries).

export interface ZipInputFile {
    name: string;
    data: Uint8Array<ArrayBuffer>;
    date: Date;
}

export interface ZipEntry {
    name: string;
    size: number; // uncompressed
    read(): Promise<Uint8Array<ArrayBuffer>>;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

const crc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8); // the index is always 0 to 255
    return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date: Date) => ({
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
});

export const createZip = (files: ZipInputFile[]): Blob => {
    const encoder = new TextEncoder();
    const parts: BlobPart[] = [];
    const central: (DataView<ArrayBuffer> | Uint8Array<ArrayBuffer>)[] = [];
    let offset = 0;

    for (const { name, data, date } of files) {
        const nameBytes = encoder.encode(name);
        const crc = crc32(data);
        const { time, date: day } = dosDateTime(date);

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true); // version needed
        local.setUint16(6, 0x0800, true); // UTF-8 names
        local.setUint16(8, 0, true); // stored
        local.setUint16(10, time, true);
        local.setUint16(12, day, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, data.length, true);
        local.setUint32(22, data.length, true);
        local.setUint16(26, nameBytes.length, true);
        parts.push(local, nameBytes, data);

        const entry = new DataView(new ArrayBuffer(46));
        entry.setUint32(0, 0x02014b50, true);
        entry.setUint16(4, 20, true); // version made by
        entry.setUint16(6, 20, true); // version needed
        entry.setUint16(8, 0x0800, true);
        entry.setUint16(10, 0, true);
        entry.setUint16(12, time, true);
        entry.setUint16(14, day, true);
        entry.setUint32(16, crc, true);
        entry.setUint32(20, data.length, true);
        entry.setUint32(24, data.length, true);
        entry.setUint16(28, nameBytes.length, true);
        entry.setUint32(42, offset, true);
        central.push(entry, nameBytes);

        offset += 30 + nameBytes.length + data.length;
    }

    const centralSize = central.reduce((size, part) => size + part.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);

    return new Blob([...parts, ...central, end], { type: 'application/zip' });
};

// Lists the files of a zip archive without extracting them
export const listZip = (buffer: ArrayBuffer): ZipEntry[] => {
    const view = new DataView(buffer);
    let endOffset = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 0xffff); i--) {
        if (view.getUint32(i, true) === 0x06054b50) {
            endOffset = i;
            break;
        }
    }
    if (endOffset < 0) throw new Error('not a zip file');

    const decoder = new TextDecoder();
    const count = view.getUint16(endOffset + 10, true);
    let pos = view.getUint32(endOffset + 16, true);
    const entries: ZipEntry[] = [];

    for (let i = 0; i < count; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('corrupt zip file');
        const method = view.getUint16(pos + 10, true);
        const compressedSize = view.getUint32(pos + 20, true);
        const size = view.getUint32(pos + 24, true);
        const nameLength = view.getUint16(pos + 28, true);
        const extraLength = view.getUint16(pos + 30, true);
        const commentLength = view.getUint16(pos + 32, true);
        const localOffset = view.getUint32(pos + 42, true);
        const name = decoder.decode(new Uint8Array(buffer, pos + 46, nameLength));
        pos += 46 + nameLength + extraLength + commentLength;

        if (name.endsWith('/')) continue; // directory

        const read = async () => {
            const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
            const raw = new Uint8Array(buffer, dataStart, compressedSize);
            if (method === 0) return raw.slice();
            if (method === 8) {
                const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                return new Uint8Array(await new Response(stream).arrayBuffer());
            }
            throw new Error(`${name}: unsupported zip compression method ${method}`);
        };
        entries.push({ name, size, read });
    }

    return entries;
};
