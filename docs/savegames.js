// Export and import of save games for the stock fheroes2 web launcher (index.html).
// Added to the launcher by the Dockerfile of fheroes2-wasm-build (needs zip.js): adds "Export saves" and "Import saves" buttons
// next to "Start game". Saves are exported as a zip file; import accepts such zip files or single save files.
(() => {
    'use strict';

    const { createZip, readZip } = globalThis.fheroes2Zip;

    // HOME is set to /fheroes2 by the launcher, fheroes2 then stores its saves in $HOME/.fheroes2/files/save
    const saveDir = '/fheroes2/.fheroes2/files/save';
    const saveFileRE = /\.sav[chm]?$/i;

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
