// The parts of the Emscripten runtime that the launcher uses. fheroes2.js is a classic (non-modularized) script,
// so these are globals once it has been loaded.

export interface EmscriptenStat {
    mode: number;
    size: number;
    mtime: Date | number;
}

export interface EmscriptenFS {
    analyzePath(path: string): { exists: boolean };
    isDir(mode: number): boolean;
    isFile(mode: number): boolean;
    stat(path: string): EmscriptenStat;
    readdir(path: string): string[];
    readFile(path: string): Uint8Array<ArrayBuffer>;
    writeFile(path: string, data: Uint8Array | string): void;
    mkdir(path: string): void;
    rmdir(path: string): void;
    unlink(path: string): void;
    mount(type: unknown, options: object, mountpoint: string): void;
    syncfs(populate: boolean, callback: (err: unknown) => void): void;
}

// the Module properties the engine reads (-sINCOMING_MODULE_JS_API in upstream's src/dist/Makefile.emscripten)
export interface EmscriptenModule {
    canvas: HTMLCanvasElement;
    preRun: (() => void)[];
    setStatus: (status: string) => void;
}

declare global {
    var Module: EmscriptenModule;
    var FS: EmscriptenFS;
    var IDBFS: unknown;
    var ENV: Record<string, string>;
    var JSEvents: { eventHandlers: unknown[] } | undefined;
    function addRunDependency(id: string): void;
    function removeRunDependency(id: string): void;
}
