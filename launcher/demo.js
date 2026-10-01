// Demo support for the stock fheroes2 web launcher (index.html), the browser version of
// script/demo/download_demo_version.sh upstream. Added by the Dockerfile of fheroes2-wasm-build (needs zip.js).
// archive.org does not allow cross-origin downloads, so the launcher links to the demo archive and lets the player
// load the downloaded h2demo.zip. Its DATA and MAPS directories are stored like an uploaded game directory (the stock
// uploader cannot be used: it does not accept zip files and requires HEROES2X.AGG, which the demo does not have).
(() => {
    'use strict';

    const { readZip } = globalThis.fheroes2Zip;

    const demoUrl = 'https://archive.org/download/HeroesofMightandMagicIITheSuccessionWars_1020/h2demo.zip';
    const demoSHA256 = '12048c8b03875c81e69534a3813aaf6340975e77b762dc1b79a4ff5514240e3c';

    const sha256 = async buffer => {
        if (!globalThis.crypto?.subtle) return null; // only available in secure contexts (https, localhost)
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
        return [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
    };

    const installDemo = async file => {
        if (typeof FS === 'undefined' || typeof ENV === 'undefined') throw new Error('the game is still loading, please try again in a moment');

        const archive = await file.arrayBuffer();
        const hash = await sha256(archive);
        if (hash !== null && hash !== demoSHA256) throw new Error(`${file.name} is not the expected demo archive (SHA-256 ${hash})`);

        const files = await readZip(archive, name => /^(DATA|MAPS)\/[^/]+$/i.test(name));
        if (!files.some(({ name }) => /^DATA\/HEROES2\.AGG$/i.test(name))) throw new Error(`HEROES2.AGG is missing in ${file.name}`);

        // same layout as an uploaded game directory: <FHEROES2_DATA>/data and <FHEROES2_DATA>/maps
        for (const { name, data } of files) {
            const [dir, fileName] = name.split('/');
            const path = `${ENV.FHEROES2_DATA}/${dir.toLowerCase()}`;
            Module.mkdirWithParents(path);
            FS.writeFile(`${path}/${fileName}`, data);
        }

        await new Promise((resolve, reject) => FS.syncfs(false, err => (err ? reject(err) : resolve())));
    };

    // ---- UI ----

    const box = document.createElement('div');
    Object.assign(box.style, {
        position: 'absolute',
        top: '25vh',
        width: '100%',
        textAlign: 'center',
        fontSize: '24px'
    });
    // clicks inside the box must not open the folder selection of the uploader
    box.addEventListener('click', event => event.stopPropagation());

    const link = Object.assign(document.createElement('a'), {
        href: demoUrl,
        textContent: 'Download the free demo (h2demo.zip, 21 MB)'
    });
    Object.assign(link.style, { color: '#fff', webkitTextStroke: '0', textShadow: '0 0 3px #000, 0 0 6px #000' });

    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.zip' });
    input.style.display = 'none';

    const loadLabel = 'Load the downloaded h2demo.zip';
    const button = Object.assign(document.createElement('button'), { textContent: loadLabel });
    Object.assign(button.style, { fontSize: '24px', marginTop: '10px', cursor: 'pointer' });
    button.addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
        const [file] = input.files;
        input.value = '';
        if (!file) return;

        button.disabled = true;
        button.textContent = 'Unpacking demo...';
        installDemo(file)
            .then(() => {
                box.remove();
                Module.startGame();
            })
            .catch(err => {
                alert(`Could not load the demo: ${err.message ?? err}`);
                button.textContent = loadLabel;
                button.disabled = false;
            });
    });

    box.append(link, document.createElement('br'), button, input);
    document.querySelector('#uploader').append(box);
})();
