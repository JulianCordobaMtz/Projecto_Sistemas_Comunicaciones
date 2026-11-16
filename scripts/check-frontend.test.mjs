import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('./check-frontend.mjs', import.meta.url));

function fixture(t, overrides = {}) {
    const temporary = mkdtempSync(join(tmpdir(), 'scp-frontend-'));
    t.after(() => rmSync(temporary, { recursive: true, force: true }));
    const root = join(temporary, 'frontend');
    const files = {
        'index.html': '<link href="css/site.css" rel="stylesheet"><script type="module" src="js/main.js"></script>',
        'css/site.css': 'body { color: black; }',
        'js/main.js': 'import { value } from "./data.js"; window.alert(value);',
        'js/data.js': 'export const value = 1;',
        ...overrides,
    };
    for (const [path, source] of Object.entries(files)) {
        if (source === null) continue;
        const file = join(root, path);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, source);
    }
    return root;
}

function check(root) {
    const result = spawnSync(process.execPath, [checker, root], {
        encoding: 'utf8', timeout: 30_000,
    });
    assert.ifError(result.error);
    return { ...result, output: result.stdout + result.stderr };
}

test('un frontend válido pasa como módulos ES sin ejecutar código del navegador', (t) => {
    const result = check(fixture(t));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /2 JavaScript/);
    assert.match(result.output, /3 referencias locales/);
});

test('la sintaxis inválida falla incluso en un JS anidado que ningún HTML importa', (t) => {
    const result = check(fixture(t, { 'js/nested/broken.js': 'export const = ;' }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /js\/nested\/broken\.js: sintaxis JavaScript inválida/);
});

test('rechaza un enlace a JavaScript inválido y la referencia HTML sin analizar su destino', (t) => {
    const root = fixture(t, {
        'index.html': '<link href="css/site.css"><script src="js/main.js"></script><script src="js/linked.js"></script>',
        'js/shared-source.txt': 'export const = ;',
    });
    symlinkSync('shared-source.txt', join(root, 'js/linked.js'));
    const result = check(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /js\/linked\.js: enlace simbólico rechazado/);
    assert.match(result.output, /index\.html: referencia local "js\/linked\.js"[^\n]*enlace simbólico rechazado/);
    assert.doesNotMatch(result.output, /sintaxis JavaScript inválida/);
});

test('rechaza directorios enlazados sin recorrerlos ni aceptar referencias a sus archivos', (t) => {
    const root = fixture(t, {
        'index.html': '<link href="css/site.css"><script src="js/main.js"></script><script src="shared/broken.js"></script><a href="shared/">Abrir</a>',
        'js/main.js': 'import "../shared/broken.js";',
    });
    const target = join(dirname(root), 'directory-target');
    mkdirSync(target);
    writeFileSync(join(target, 'broken.js'), 'export const = ;');
    symlinkSync(target, join(root, 'shared'), 'dir');
    const result = check(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /frontend\/shared: enlace simbólico rechazado/);
    assert.match(result.output, /index\.html: referencia local "shared\/broken\.js"[^\n]*enlace simbólico rechazado/);
    assert.match(result.output, /index\.html: referencia local "shared\/"[^\n]*enlace simbólico rechazado/);
    assert.match(result.output, /main\.js: referencia local "\.\.\/shared\/broken\.js"[^\n]*enlace simbólico rechazado/);
    assert.match(result.output, /Revisados 1 HTML, 2 JavaScript/);
    assert.doesNotMatch(result.output, /sintaxis JavaScript inválida/);
});

test('rechaza un índice enlazado al resolver la referencia a una carpeta real', (t) => {
    const root = fixture(t, {
        'index.html': '<link href="css/site.css"><script src="js/main.js"></script><a href="pages/">Abrir</a>',
        'pages/content.txt': '<!doctype html><title>Contenido</title>',
    });
    symlinkSync('content.txt', join(root, 'pages/index.html'));
    const result = check(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /pages\/index\.html: enlace simbólico rechazado/);
    assert.match(result.output, /index\.html: referencia local "pages\/"[^\n]*enlace simbólico rechazado/);
});

test('una referencia HTML local inexistente falla e informa origen y destino', (t) => {
    const result = check(fixture(t, { 'index.html': '<img src="images/missing.png?size=2#preview">' }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /index\.html: referencia local "images\/missing\.png\?size=2#preview"/);
    assert.match(result.output, /images\/missing\.png/);
});

test('imports laterales, multilínea y reexports comprueban sus destinos', (t) => {
    const result = check(fixture(t, {
        'js/main.js': 'import "./missing-side.js";\nimport {\n value\n} from "./missing-multiline.js";\nexport * from "./missing-export.js";',
    }));
    assert.equal(result.status, 1, result.output);
    for (const name of ['missing-side', 'missing-multiline', 'missing-export']) {
        assert.ok(result.output.includes(`${name}.js`), result.output);
    }
    assert.match(result.output, /Resultado: 3 errores/);
});

test('resuelve desde cada archivo, incluyendo sufijos URL, raíz y caracteres codificados', (t) => {
    const result = check(fixture(t, {
        'index.html': '<a href="pages/monitor%20%C3%A1.html?view=1&amp;size=2#status">Abrir</a><img src="assets/a%23b%3Fc.svg?size=2#icon"><link href="/css/site.css">',
        'pages/monitor á.html': '<link href=../css/site.css?theme=dark#colors><script src="../js/main.js?rev=1#module"></script><a href="#status">Estado</a>',
        'assets/a#b?c.svg': '<svg></svg>',
        'js/main.js': 'import { value } from "./data.js?rev=1#value"; window.alert(value);',
    }));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /7 referencias locales/);
});

test('ignora direcciones externas y referencias escritas en comentarios o cadenas', (t) => {
    const result = check(fixture(t, {
        'index.html': '<!-- <img src="missing.png"> --><a href="https://example.invalid/missing">Web</a><img src="//cdn.invalid/missing"><a href="mailto:someone@example.invalid">Correo</a><img src="data:image/png;base64,AA=="><script>const text = \'<img src="missing.png">\';</script>',
        'js/main.js': '// import "./missing-comment.js";\n/* export * from "./missing-block.js"; */\nconst text = \'import "./missing-string.js";\';\nimport "https://example.invalid/module.js";',
    }));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /0 referencias locales/);
    assert.match(result.output, /5 externas omitidas/);
});

test('las rutas URL mal codificadas fallan con un diagnóstico', (t) => {
    const result = check(fixture(t, { 'index.html': '<img src="assets/%ZZ.png">' }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /index\.html: referencia local "assets\/%ZZ.png"/);
    assert.match(result.output, /ruta inválida/);
});

test('los archivos vacíos son advertencias y se mantienen válidos como marcadores', (t) => {
    const result = check(fixture(t, { 'pages/placeholder.html': '', 'js/websocket.js': '' }));
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /placeholder\.html: archivo vacío/);
    assert.match(result.output, /websocket\.js: archivo vacío/);
    assert.match(result.output, /0 errores y 2 advertencias/);
});

test('falla si el frontend no existe o está vacío', (t) => {
    const root = fixture(t);
    rmSync(root, { recursive: true });
    assert.equal(check(root).status, 1);
    mkdirSync(root);
    const result = check(root);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /se esperaba al menos un archivo JavaScript/);
});

test('falla si falta la entrada o una categoría de archivos esperada', (t) => {
    for (const { removed, diagnostics } of [
        {
            removed: { 'index.html': null },
            diagnostics: [/index\.html: falta la página de entrada/, /se esperaba al menos un archivo HTML con contenido/],
        },
        {
            removed: { 'js/main.js': null, 'js/data.js': null },
            diagnostics: [/se esperaba al menos un archivo JavaScript con contenido/],
        },
        {
            removed: { 'css/site.css': null },
            diagnostics: [/se esperaba al menos un archivo CSS con contenido/],
        },
    ]) {
        const result = check(fixture(t, removed));
        assert.equal(result.status, 1, result.output);
        for (const diagnostic of diagnostics) assert.match(result.output, diagnostic);
    }
});

test('falla si solo encuentra marcadores vacíos', (t) => {
    const result = check(fixture(t, {
        'index.html': '', 'js/main.js': '', 'js/data.js': '', 'css/site.css': '',
    }));
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /página de entrada o está vacía/);
    assert.match(result.output, /se esperaba al menos un archivo JavaScript con contenido/);
});
