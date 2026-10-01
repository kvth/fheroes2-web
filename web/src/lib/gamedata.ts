// Installation of the original game data (a game folder or a zip of it, e.g. the free demo h2demo.zip)
import { DATA_DIR } from './engine';
import { list, persist, remove, writeFile } from './fs';
import { listZip } from './zip';

export interface GameDataInfo {
    edition: string;
    demo: boolean;
    maps: number;
    music: boolean;
}

// a file of a selected game folder or zip, path like 'Root/DATA/HEROES2.AGG'
export interface GameFileEntry {
    path: string;
    size: number;
    read(): Promise<Uint8Array<ArrayBuffer>>;
}

export const DEMO_URL = 'https://archive.org/download/HeroesofMightandMagicIITheSuccessionWars_1020/h2demo.zip';

// directories of the game folder that fheroes2 uses; their names are stored in lower case
const GAME_DIRS = ['anim', 'data', 'heroes2', 'maps', 'music'];

// returns null if no game data is installed
export const gameDataInfo = (): GameDataInfo | null => {
    const data = list(`${DATA_DIR}/data`).map(name => name.toLowerCase());
    if (!data.includes('heroes2.agg')) return null;

    const expansion = data.includes('heroes2x.agg');
    const demo = !expansion && data.includes('h2offer.smk');
    return {
        edition: demo ? 'Demo version' : expansion ? 'The Succession Wars + The Price of Loyalty' : 'The Succession Wars',
        demo,
        maps: list(`${DATA_DIR}/maps`).filter(name => /\.m[px]2$/i.test(name)).length,
        music: list(`${DATA_DIR}/music`).length > 0
    };
};

// entries of a selected folder (input with webkitdirectory) or a selected zip file
export const entriesFromFiles = async (files: File[]): Promise<GameFileEntry[]> => {
    const [first] = files;
    if (files.length === 1 && first && /\.zip$/i.test(first.name)) {
        return listZip(await first.arrayBuffer()).map(({ name, size, read }) => ({ path: name, size, read }));
    }
    return [...files].map(file => ({
        path: file.webkitRelativePath || file.name,
        size: file.size,
        read: async () => new Uint8Array(await file.arrayBuffer())
    }));
};

// Replaces the installed game data with the game folder found in entries.
// onProgress(bytesDone, bytesTotal) is called while copying.
export const installGameData = async (
    entries: GameFileEntry[],
    onProgress: (bytesDone: number, bytesTotal: number) => void = () => {}
): Promise<GameDataInfo | null> => {
    // the game folder is the one containing DATA/HEROES2.AGG (in any case), take the outermost one
    const roots = entries
        .map(({ path }) => /^(|.*\/)data\/heroes2\.agg$/i.exec(path)?.[1])
        .filter((root): root is string => root !== undefined)
        .sort((a, b) => a.length - b.length);
    const [root] = roots;
    if (root === undefined) {
        throw new Error('No Heroes of Might and Magic II game data found: the folder or zip must contain DATA/HEROES2.AGG.');
    }

    const files = entries
        .filter(({ path }) => path.startsWith(root))
        .map(entry => {
            const [dir = '', ...rest] = entry.path.slice(root.length).split('/');
            return { ...entry, dir: dir.toLowerCase(), rest };
        })
        .filter(({ dir, rest }) => rest.length > 0 && GAME_DIRS.includes(dir) && !rest.some(part => part.startsWith('.')));

    const total = files.reduce((sum, { size }) => sum + size, 0);
    let done = 0;
    onProgress(done, total);

    remove(DATA_DIR);
    for (const { dir, rest, size, read } of files) {
        writeFile(`${DATA_DIR}/${dir}/${rest.join('/')}`, await read());
        done += size;
        onProgress(done, total);
    }
    await persist();

    return gameDataInfo();
};

export const removeGameData = async () => {
    remove(DATA_DIR);
    await persist();
};
