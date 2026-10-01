// Loads the fheroes2 engine (fheroes2.js from the upstream Emscripten build) and holds it back until startGame().
//
// The engine only reads canvas, preRun and setStatus from the Module object (-sINCOMING_MODULE_JS_API in upstream's
// src/dist/Makefile.emscripten), and this launcher sets all three. Everything else is accessed through the
// globals FS, ENV, IDBFS, addRunDependency and removeRunDependency, which fheroes2.js defines as a classic
// (non-modularized) script, see ../emscripten.d.ts.
import { reactive } from 'vue';

// HOME is where fheroes2 keeps its configuration and saves ($HOME/.fheroes2), FHEROES2_DATA the game data directory
export const HOME_DIR = '/fheroes2';
export const DATA_DIR = `${HOME_DIR}/data`;

export const engine = reactive({
    fsReady: false, // the persistent file system (IndexedDB) has been loaded
    download: { loaded: 0, total: 0 }, // fheroes2.data download progress in bytes
    started: false, // startGame() has been called
    running: false, // the game is running and owns the canvas
    quit: false, // the player quit the game (the engine cannot be started again without reloading the page)
    error: null as string | null
});

let resolveFsReady: () => void;
export const fsReady = new Promise<void>(resolve => (resolveFsReady = resolve));

const setStatus = (status: string) => {
    const progress = /\((\d+)\/(\d+)\)/.exec(status ?? '');
    if (progress) {
        engine.download = { loaded: Number(progress[1]), total: Number(progress[2]) };
    } else if (status === 'Running...') {
        engine.running = true;
    }
};

// SDL only handles mouse buttons after the pointer entered the canvas. The canvas appears under a pointer that is
// already there when the game starts, and browsers do not always report that as entering: do it before the first click.
const reportPointerOnCanvas = (canvas: HTMLCanvasElement) => {
    let pointerOnCanvas = false;
    canvas.addEventListener('mouseenter', () => (pointerOnCanvas = true));
    canvas.addEventListener('mouseleave', () => (pointerOnCanvas = false));
    window.addEventListener(
        'mousedown',
        event => {
            if (event.target === canvas && !pointerOnCanvas) canvas.dispatchEvent(new MouseEvent('mouseenter'));
        },
        true
    );
};

// The web build has no exit hook (Module.onExit is not one of the Module properties the engine reads). When the game
// quits, SDL destroys its window: the canvas is resized to 0 x 0 and all event handlers are removed. Changing the
// resolution destroys the window too, but creates a new one right away, so check again a moment later.
const watchForQuit = (canvas: HTMLCanvasElement) => {
    new MutationObserver(() => {
        if (canvas.width !== 0) return;
        setTimeout(() => {
            if (canvas.width !== 0 || globalThis.JSEvents?.eventHandlers.length !== 0) return;
            // make sure everything the game wrote (settings, saves) is stored before reporting it
            globalThis.FS.syncfs(false, () => (engine.quit = true));
        }, 1000);
    }).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
};

export const loadEngine = (canvas: HTMLCanvasElement) => {
    reportPointerOnCanvas(canvas);
    watchForQuit(canvas);

    globalThis.Module = { canvas, setStatus, preRun: [setUpFileSystem] };

    const script = document.createElement('script');
    script.src = 'fheroes2.js';
    script.onerror = () => (engine.error = 'Could not load fheroes2.js');
    document.body.append(script);
};

// Runs before the engine starts, once the WebAssembly module is instantiated (loading the stored files from IndexedDB
// needs its memory). The engine then waits for the "launcher" dependency, see startGame().
const setUpFileSystem = () => {
    const { ENV, FS, IDBFS } = globalThis;
    Object.assign(ENV, { HOME: HOME_DIR, FHEROES2_DATA: DATA_DIR });

    FS.mkdir(HOME_DIR);
    FS.mount(IDBFS, {}, HOME_DIR);

    // keep the engine from starting until the player presses "Play"
    globalThis.addRunDependency('launcher');

    FS.syncfs(true, err => {
        if (err) engine.error = `Could not load the browser storage: ${err}`;
        engine.fsReady = true;
        resolveFsReady();
    });
};

export const startGame = () => {
    if (engine.started) return;
    engine.started = true;
    globalThis.removeRunDependency('launcher');
};
