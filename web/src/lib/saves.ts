// Save games of fheroes2 ($HOME/.fheroes2/files/save): listing, export as zip and import
import { HOME_DIR } from './engine';
import { list, persist, remove, writeFile } from './fs';
import { createZip, listZip } from './zip';

export const SAVE_DIR = `${HOME_DIR}/.fheroes2/files/save`;
const SAVE_FILE_RE = /\.sav[chm]?$/i;

export interface SaveInfo {
    name: string;
    size: number;
    date: Date;
}

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;
const isSaveFile = (name: string): boolean => !name.startsWith('.') && SAVE_FILE_RE.test(name);

// newest first
export const listSaves = (): SaveInfo[] =>
    list(SAVE_DIR)
        .filter(isSaveFile)
        .map(name => {
            const { size, mtime } = globalThis.FS.stat(`${SAVE_DIR}/${name}`);
            return { name, size, date: new Date(mtime) };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

export const exportSaves = (): Blob =>
    createZip(listSaves().map(({ name, date }) => ({ name, data: globalThis.FS.readFile(`${SAVE_DIR}/${name}`), date })));

// files: zip files and/or single save files. confirmOverwrite(names) decides whether existing saves may be replaced.
// Returns the names of the imported saves.
export const importSaves = async (files: File[], confirmOverwrite: (names: string[]) => boolean): Promise<string[]> => {
    const saves: { name: string; read: () => Promise<Uint8Array<ArrayBuffer>> }[] = [];
    for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
            for (const entry of listZip(await file.arrayBuffer())) {
                if (isSaveFile(baseName(entry.name))) saves.push({ name: baseName(entry.name), read: entry.read });
            }
        } else if (isSaveFile(file.name)) {
            saves.push({ name: file.name, read: async () => new Uint8Array(await file.arrayBuffer()) });
        }
    }
    if (saves.length === 0) throw new Error('No save games (.sav, .savc, .savh, .savm) found in the selected files.');

    const existing = new Set(listSaves().map(({ name }) => name));
    const overwritten = saves.map(({ name }) => name).filter(name => existing.has(name));
    if (overwritten.length > 0 && !confirmOverwrite(overwritten)) return [];

    for (const { name, read } of saves) writeFile(`${SAVE_DIR}/${name}`, await read());
    await persist();
    return saves.map(({ name }) => name);
};

export const deleteSave = async (name: string) => {
    remove(`${SAVE_DIR}/${name}`);
    await persist();
};
