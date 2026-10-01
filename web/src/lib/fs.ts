// Helpers for the Emscripten file system of the engine (globalThis.FS, available after engine.fsReady)

const fs = () => globalThis.FS;

export const exists = (path: string): boolean => fs().analyzePath(path).exists;

export const isDir = (path: string): boolean => exists(path) && fs().isDir(fs().stat(path).mode);

// names of the entries of a directory, [] if it does not exist
export const list = (path: string): string[] => (isDir(path) ? fs().readdir(path).filter(name => name !== '.' && name !== '..') : []);

export const mkdirs = (path: string) => {
    let current = '';
    for (const part of path.split('/').filter(Boolean)) {
        current += `/${part}`;
        if (!exists(current)) fs().mkdir(current);
    }
};

export const writeFile = (path: string, data: Uint8Array) => {
    mkdirs(path.slice(0, path.lastIndexOf('/')));
    fs().writeFile(path, data);
};

export const remove = (path: string) => {
    if (!exists(path)) return;
    if (isDir(path)) {
        for (const name of list(path)) remove(`${path}/${name}`);
        fs().rmdir(path);
    } else {
        fs().unlink(path);
    }
};

// write the in-memory file system to IndexedDB
export const persist = () =>
    new Promise<void>((resolve, reject) => fs().syncfs(false, err => (err ? reject(err) : resolve())));
