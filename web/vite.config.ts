import { createReadStream, existsSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

// Files of the fheroes2 build that are placed next to the launcher (see Dockerfile)
const engineFiles = ['fheroes2.js', 'fheroes2.wasm', 'fheroes2.data', 'fheroes2.jpeg', 'COMMIT'];
const contentTypes: Record<string, string> = {
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
    '.jpeg': 'image/jpeg'
};

// For "npm run dev": serve the engine files from an existing build (default: ../docs)
const serveEngineFiles = (): Plugin => ({
    name: 'fheroes2-engine-files',
    apply: 'serve',
    configureServer(server) {
        const buildDir = resolve(import.meta.dirname, process.env.FHEROES2_BUILD_DIR ?? '../docs');
        server.middlewares.use((req, res, next) => {
            const file = new URL(req.url ?? '/', 'http://localhost').pathname.slice(1);
            const path = resolve(buildDir, file);
            if (!engineFiles.includes(file) || !existsSync(path)) return next();
            res.setHeader('Content-Type', contentTypes[extname(file)] ?? 'application/octet-stream');
            createReadStream(path).pipe(res);
        });
    }
});

export default defineConfig({
    base: './',
    plugins: [vue(), serveEngineFiles()]
});
