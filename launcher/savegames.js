// Export and import of save games for the stock fheroes2 web launcher (index.html).
// Added to the launcher by the Dockerfile of fheroes2-wasm-build: adds "Export saves" and "Import saves" buttons
// next to "Start game". Saves are exported as a zip file; import accepts such zip files or single save files.
(() => {
    'use strict';

    // HOME is set to /fheroes2 by the launcher, fheroes2 then stores its saves in $HOME/.fheroes2/files/save
    const saveDir = '/fheroes2/.fheroes2/files/save';
    const saveFileRE = /\.sav[chm]?$/i;

    // ---- minimal zip writer (stored entries) and reader (stored and deflated entries) ----

    const crcTable = Array.from({ length: 256 }, (_, n) => {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        return c >>> 0;
    });

    const crc32 = data => {
        let crc = 0xffffffff;
        for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    };

    const dosDateTime = date => ({
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    });

    // files: [{ name: string, data: Uint8Array, date: Date }]
    const createZip = files => {
        const encoder = new TextEncoder();
        const parts = [];
        const central = [];
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

    // returns [{ name: string, data: Uint8Array }]
    const readZip = async buffer => {
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
        const entries = [];

        for (let i = 0; i < count; i++) {
            if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('corrupt zip file');
            const method = view.getUint16(pos + 10, true);
            const compressedSize = view.getUint32(pos + 20, true);
            const nameLength = view.getUint16(pos + 28, true);
            const extraLength = view.getUint16(pos + 30, true);
            const commentLength = view.getUint16(pos + 32, true);
            const localOffset = view.getUint32(pos + 42, true);
            const name = decoder.decode(new Uint8Array(buffer, pos + 46, nameLength));
            pos += 46 + nameLength + extraLength + commentLength;

            if (name.endsWith('/')) continue; // directory
            const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
            const raw = new Uint8Array(buffer, dataStart, compressedSize);

            if (method === 0) {
                entries.push({ name, data: raw.slice() });
            } else if (method === 8) {
                const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                entries.push({ name, data: new Uint8Array(await new Response(stream).arrayBuffer()) });
            } else {
                console.warn(`Skipping ${name}: unsupported zip compression method ${method}`);
            }
        }

        return entries;
    };

    // ---- export / import ----

    const listSaveFiles = () => {
        try {
            return FS.readdir(saveDir).filter(name => FS.isFile(FS.stat(`${saveDir}/${name}`).mode));
        } catch (ignore) {
            return []; // no save directory yet
        }
    };

    const exportSaves = () => {
        const names = listSaveFiles();
        if (names.length === 0) return alert('There are no save games to export yet.');

        const zip = createZip(names.map(name => {
            const path = `${saveDir}/${name}`;
            return { name, data: FS.readFile(path), date: FS.stat(path).mtime };
        }));

        const link = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(zip),
            download: `fheroes2-saves-${new Date().toISOString().slice(0, 10)}.zip`
        });
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    };

    const importSaves = async fileList => {
        const imported = [];
        for (const file of fileList) {
            if (/\.zip$/i.test(file.name)) {
                imported.push(...await readZip(await file.arrayBuffer()));
            } else {
                imported.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
            }
        }

        // only plain file names, zip entries in subdirectories are flattened
        const saves = imported
            .map(({ name, data }) => ({ name: name.split(/[\\/]/).pop(), data }))
            .filter(({ name }) => name && !name.startsWith('.') && saveFileRE.test(name));
        if (saves.length === 0) return alert('No save games (.sav, .savc, .savh, .savm) found in the selected files.');

        const existing = new Set(listSaveFiles());
        const overwritten = saves.filter(({ name }) => existing.has(name)).map(({ name }) => name);
        if (overwritten.length > 0 && !confirm(`Overwrite these existing save games?\n\n${overwritten.join('\n')}`)) return;

        Module.mkdirWithParents(saveDir);
        for (const { name, data } of saves) FS.writeFile(`${saveDir}/${name}`, data);
        FS.syncfs(false, err => {
            if (err) return alert(`Failed to store the save games: ${err}`);
            alert(`Imported ${saves.length} save game(s):\n\n${saves.map(({ name }) => name).join('\n')}`);
        });
    };

    // ---- UI ----

    const input = Object.assign(document.createElement('input'), {
        type: 'file',
        multiple: true,
        accept: '.zip,.sav,.savc,.savh,.savm'
    });
    input.style.display = 'none';
    input.addEventListener('change', () => {
        const files = [...input.files];
        input.value = '';
        importSaves(files).catch(err => alert(`Import failed: ${err.message ?? err}`));
    });

    const buttons = document.querySelector('#launcher .buttons');
    buttons.append(
        input,
        Object.assign(document.createElement('button'), { textContent: 'Export saves', onclick: exportSaves }),
        Object.assign(document.createElement('button'), { textContent: 'Import saves', onclick: () => input.click() })
    );
})();
