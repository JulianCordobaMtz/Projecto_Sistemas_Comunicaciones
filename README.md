# Sistema de Comunicación Prioritaria

[![CI del frontend](https://github.com/JulianCordobaMtz/Projecto_Sistemas_Comunicaciones/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/JulianCordobaMtz/Projecto_Sistemas_Comunicaciones/actions/workflows/ci.yml)

Proyecto académico con un frontend de HTML, CSS y JavaScript con módulos ES.
Actualmente usa datos simulados y no requiere instalar paquetes ni compilar.

## Preparación en WSL Ubuntu

Con [nvm](https://github.com/nvm-sh/nvm) instalado en tu usuario, ejecuta desde
la raíz del repositorio en cada terminal Bash nueva:

```bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install
nvm use
node --version
```

`.nvmrc` fija Node **24.22.3** tanto para desarrollo local como para GitHub Actions.
`nvm install` instala esa versión con su npm incluido si todavía no está disponible.
Los perfiles de shell no necesitan modificarse.

## Comprobaciones locales y CI

Desde la raíz del repositorio:

```bash
node --test scripts/check-frontend.test.mjs
node scripts/check-frontend.mjs
node --test backend/test/*.test.mjs
```

Las pruebas del frontend verifican el comprobador con archivos temporales; no son
pruebas funcionales de la aplicación. El comprobador revisa recursivamente la sintaxis
de los archivos `.js`, `.mjs` y `.cjs` como módulos ES, sin ejecutar el frontend.
Usa el analizador nativo `SourceTextModule`, cuya API experimental se activa
únicamente en un subproceso de Node; no enlaza ni evalúa los módulos.

También comprueba que existan los destinos locales de los atributos HTML `href`,
`src`, `poster`, `action`, `formaction`, `data` y `xlink:href`, y de los imports y
reexports estáticos de JavaScript relativos o desde la raíz del sitio. Resuelve
las rutas desde el archivo que las declara; `/` representa `frontend/`. Contempla
parámetros, fragmentos, caracteres codificados y las entidades HTML básicas y
numéricas. Los destinos externos se omiten sin hacer solicitudes de red.

Falla ante sintaxis o referencias inválidas, si falta `frontend/index.html` o si
no encuentra HTML, JavaScript y CSS con contenido. Los archivos vacíos existentes
se reportan como advertencias y se conservan. Para probar otra carpeta se puede
usar `node scripts/check-frontend.mjs /ruta/al/frontend`.

Los enlaces simbólicos de archivos y directorios dentro del frontend se rechazan
con un error que identifica su ruta. No se leen sus destinos ni se recorren los
directorios enlazados. Tampoco se aceptan referencias locales que dependan de
esos enlaces, incluido un `index.html` enlazado al abrir una carpeta.

Este CI **no garantiza que la aplicación funcione**: no comprueba estructura HTML,
sintaxis CSS ni sus `url()`/`@import`, `srcset`, JavaScript inline, imports dinámicos,
nombres exportados, identificadores de fragmentos, DOM, comportamiento, apariencia,
accesibilidad ni disponibilidad de servicios externos. Aún faltan pruebas de la
aplicación en navegador.

Las 82 pruebas unitarias del backend cubren la cola prioritaria y el validador
de mensajes. Usan `node:test`, `node:assert/strict` y módulos nativos de Node,
al igual que la suite del comprobador del frontend; ninguna necesita instalar
dependencias. Las pruebas del backend no incluyen HTTP, hardware ni congestión
Wi-Fi.

GitHub Actions ejecutará las pruebas del comprobador y después la revisión del
frontend en un job, y las pruebas unitarias de cola y validador del backend en
otro job independiente. Se mantienen los PR hacia `main`, pushes a `main` y
`chore/ci`, y ejecución manual cuando el workflow esté disponible en la rama
predeterminada. No instala dependencias ni configura caché de npm. Las acciones
oficiales se fijan por SHA, con sus versiones indicadas en el workflow.
