import { spawnSync } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../frontend/', import.meta.url));
const origin = 'https://frontend.invalid';
const urlAttributes = new Set(['href', 'src', 'poster', 'action', 'formaction', 'data', 'xlink:href']);

// Node analiza los módulos, incluidos imports laterales y reexports. Nunca se
// enlazan ni evalúan: document, window y los demás efectos del navegador no corren.
// SourceTextModule requiere esta API experimental; el flag se limita al subproceso.
const parseModules = String.raw`
    import { readFileSync } from 'node:fs';
    import { SourceTextModule } from 'node:vm';
    const files = JSON.parse(readFileSync(0, 'utf8'));
    const results = files.map(({ file, source }) => {
        try {
            const module = new SourceTextModule(source, { identifier: file });
            return { file, imports: module.moduleRequests.map(({ specifier }) => specifier) };
        } catch (error) {
            return { file, error: error.message };
        }
    });
    process.stdout.write(JSON.stringify(results));
`;

function collectFiles(directory, rejectLink) {
    if (lstatSync(directory).isSymbolicLink()) {
        rejectLink(directory);
        return [];
    }
    return readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((entry) => {
            const file = resolve(directory, entry.name);
            if (entry.isSymbolicLink()) {
                rejectLink(file);
                return [];
            }
            if (entry.isDirectory()) return collectFiles(file, rejectLink);
            return entry.isFile() ? [file] : [];
        });
}

function decodeHtml(value) {
    const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    return value.replace(/&#(x[\da-f]+|\d+);?|&(amp|quot|apos|lt|gt);/gi, (_, numeric, named) => {
        if (named) return entities[named.toLowerCase()];
        const code = numeric[0].toLowerCase() === 'x'
            ? Number.parseInt(numeric.slice(1), 16) : Number(numeric);
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
            ? String.fromCodePoint(code) : '\uFFFD';
    });
}

function htmlReferences(source) {
    const references = [];
    let base;
    // Omite comentarios y el contenido de elementos de texto, pero conserva sus
    // atributos de apertura. No intenta validar la estructura completa del HTML.
    const tags = /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/\1\s*>|<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
    const attributes = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const tag of source.matchAll(tags)) {
        if (tag[0].startsWith('<!--')) continue;
        const name = (tag[1] ?? tag[3]).toLowerCase();
        for (const attribute of (tag[2] ?? tag[4]).matchAll(attributes)) {
            const key = attribute[1].toLowerCase();
            const value = attribute[2] ?? attribute[3] ?? attribute[4];
            if (!urlAttributes.has(key) || value === undefined) continue;
            const reference = decodeHtml(value).trim();
            if (name === 'base' && key === 'href') {
                base ??= reference;
            } else {
                references.push({ reference, attribute: key });
            }
        }
    }
    return { references, base };
}

function checkFrontend(root) {
    const errors = [];
    const warnings = [];
    const display = (file) => relative(process.cwd(), file) || file;
    const symbolicLinks = new Set();
    const files = collectFiles(root, (file) => {
        symbolicLinks.add(file);
        errors.push(`${display(file)}: enlace simbólico rechazado; no se sigue su destino.`);
    });
    const html = files.filter((file) => /\.html?$/i.test(file));
    const js = files.filter((file) => /\.[cm]?js$/i.test(file));
    const css = files.filter((file) => /\.css$/i.test(file));
    const sources = new Map();
    let localReferences = 0;
    let externalReferences = 0;

    for (const file of files) {
        const isText = /\.(?:html?|[cm]?js|css)$/i.test(file);
        if (isText) sources.set(file, readFileSync(file, 'utf8'));
        if (statSync(file).size === 0 || (isText && sources.get(file).trim() === '')) {
            warnings.push(`${display(file)}: archivo vacío; se conserva sin cambios.`);
        }
    }
    if (!html.includes(resolve(root, 'index.html')) || !sources.get(resolve(root, 'index.html'))?.trim()) {
        errors.push(`${display(resolve(root, 'index.html'))}: falta la página de entrada o está vacía.`);
    }
    for (const [kind, group] of [['HTML', html], ['JavaScript', js], ['CSS', css]]) {
        if (!group.some((file) => sources.get(file).trim())) {
            errors.push(`${display(root)}: se esperaba al menos un archivo ${kind} con contenido.`);
        }
    }

    const fileUrl = (file) => new URL('/' + relative(root, file).split(sep).map(encodeURIComponent).join('/'), origin);
    function rejectLinkedTarget(target) {
        for (const link of symbolicLinks) {
            if (target === link || target.startsWith(link + sep)) {
                throw new Error(`enlace simbólico rechazado: ${display(link)}`);
            }
        }
    }
    function checkReference(file, reference, base = fileUrl(file), allowIndex = false) {
        // Cualquier esquema (https:, data:, mailto:, etc.) o //host es externo.
        if (/^[a-z][\w+.-]*:/i.test(reference) || reference.startsWith('//')) {
            externalReferences++;
            return;
        }
        let target;
        try {
            const url = new URL(reference, base);
            if (url.origin !== origin) {
                externalReferences++;
                return;
            }
            // URL elimina parámetros y fragmentos antes de decodificar la ruta:
            // un %23 o %3F pertenece al nombre del archivo, no al sufijo de URL.
            const pathname = decodeURIComponent(url.pathname);
            target = resolve(root, '.' + pathname);
            localReferences++;
            // Comprueba también los directorios de la ruta antes de usar stat,
            // que seguiría enlaces. El índice de una carpeta se valida de nuevo.
            rejectLinkedTarget(target);
            if (allowIndex && statSync(target).isDirectory()) target = resolve(target, 'index.html');
            rejectLinkedTarget(target);
            if (!statSync(target).isFile()) throw new Error('el destino no es un archivo');
        } catch (error) {
            errors.push(`${display(file)}: referencia local ${JSON.stringify(reference)} -> ${target ? display(target) : '(ruta inválida)'}: ${error.message}`);
        }
    }

    for (const file of html) {
        const { references, base } = htmlReferences(sources.get(file));
        let baseUrl = fileUrl(file);
        try {
            if (base !== undefined) baseUrl = new URL(base, baseUrl);
        } catch (error) {
            errors.push(`${display(file)}: base href ${JSON.stringify(base)} inválida: ${error.message}`);
            continue;
        }
        for (const { reference, attribute } of references) {
            checkReference(file, reference, baseUrl, attribute === 'href');
        }
    }

    if (js.length) {
        const parsed = spawnSync(process.execPath, [
            '--experimental-vm-modules', '--disable-warning=ExperimentalWarning',
            '--input-type=module', '--eval', parseModules,
        ], {
            input: JSON.stringify(js.map((file) => ({ file, source: sources.get(file) }))),
            encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
        });
        if (parsed.error || parsed.status !== 0) {
            errors.push(`No se pudo analizar JavaScript: ${parsed.error?.message ?? parsed.stderr.trim()}`);
        } else {
            for (const result of JSON.parse(parsed.stdout)) {
                if (result.error) {
                    errors.push(`${display(result.file)}: sintaxis JavaScript inválida: ${result.error}`);
                    continue;
                }
                for (const reference of result.imports) {
                    if (/^(?:\.\.?\/|\/|[a-z][\w+.-]*:)/i.test(reference)) {
                        checkReference(result.file, reference);
                    }
                }
            }
        }
    }

    for (const warning of warnings) console.warn(`ADVERTENCIA: ${warning}`);
    for (const error of errors) console.error(`ERROR: ${error}`);
    console.log(`Revisados ${html.length} HTML, ${js.length} JavaScript y ${css.length} CSS; ${localReferences} referencias locales; ${externalReferences} externas omitidas.`);
    console.log(`Resultado: ${errors.length} errores y ${warnings.length} advertencias.`);
    return errors.length === 0 ? 0 : 1;
}

try {
    if (process.argv.length > 3) throw new Error('Uso: node scripts/check-frontend.mjs [directorio-frontend]');
    process.exitCode = checkFrontend(resolve(process.argv[2] ?? defaultRoot));
} catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
}
