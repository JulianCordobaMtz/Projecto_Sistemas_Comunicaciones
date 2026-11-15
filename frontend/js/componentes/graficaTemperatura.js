const COLORES_AREAS = ["#24c8db", "#ff6577", "#f4b942"];
const MAXIMO_MUESTRAS = 15;
const historialTemperatura = [];
const historialKy026 = [];

const escapar = (texto) => String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const agregarMuestra = (historial, valores, ahora) => {
    historial.push({ tiempo: ahora, valores });
    if (historial.length > MAXIMO_MUESTRAS) historial.shift();
};

const crearEscala = (minimo, maximo, pasos = 4) =>
    Array.from({ length: pasos + 1 }, (_, indice) =>
        minimo + ((maximo - minimo) * indice) / pasos
    );

const crearGraficaTemporal = ({ historial, minimo, maximo, unidad, nombres, etiqueta }) => {
    const ancho = 390;
    const alto = 220;
    const margen = { superior: 27, derecho: 14, inferior: 40, izquierdo: 38 };
    const anchoUtil = ancho - margen.izquierdo - margen.derecho;
    const altoUtil = alto - margen.superior - margen.inferior;
    const posicionX = (indice) => margen.izquierdo + (indice / (MAXIMO_MUESTRAS - 1)) * anchoUtil;
    const posicionY = (valor) => margen.superior + (1 - (valor - minimo) / (maximo - minimo)) * altoUtil;

    const lineasHorizontales = crearEscala(minimo, maximo).map((valor) => {
        const y = posicionY(valor);
        return `
            <line x1="${margen.izquierdo}" y1="${y}" x2="${ancho - margen.derecho}" y2="${y}" stroke="#294354" stroke-width="1" />
            <text x="${margen.izquierdo - 7}" y="${y + 4}" text-anchor="end" fill="#a9bbc5" font-size="9">${Math.round(valor)}</text>
        `;
    }).join("");

    const marcasTiempo = [0, 5, 10, 14].map((indice) => {
        const x = posicionX(indice);
        const segundos = (indice - (MAXIMO_MUESTRAS - 1)) * 2;
        const texto = segundos === 0 ? "ahora" : `${segundos} s`;
        return `
            <line x1="${x}" y1="${margen.superior}" x2="${x}" y2="${alto - margen.inferior}" stroke="#203746" stroke-width="1" />
            <text x="${x}" y="${alto - 20}" text-anchor="middle" fill="#a9bbc5" font-size="10">${texto}</text>
        `;
    }).join("");

    const series = nombres.map((nombre, serieIndice) => {
        const desplazamiento = MAXIMO_MUESTRAS - historial.length;
        const puntos = historial.map((muestra, indice) => ({
            x: posicionX(indice + desplazamiento),
            y: posicionY(muestra.valores[serieIndice]),
            valor: muestra.valores[serieIndice]
        }));
        const ultimo = puntos.at(-1);
        const polilinea = puntos.map(({ x, y }) => `${x},${y}`).join(" ");
        const circulos = puntos.map(({ x, y }) =>
            `<circle cx="${x}" cy="${y}" r="2.8" fill="${COLORES_AREAS[serieIndice]}" />`
        ).join("");

        return `
            <polyline points="${polilinea}" fill="none" stroke="${COLORES_AREAS[serieIndice]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
            ${circulos}
            ${ultimo ? `<text x="${ultimo.x - 5}" y="${Math.max(11, ultimo.y - 7)}" text-anchor="end" fill="${COLORES_AREAS[serieIndice]}" font-size="10" font-weight="700">${ultimo.valor}${unidad}</text>` : ""}
        `;
    }).join("");

    const leyenda = nombres.map((nombre, indice) => {
        const x = margen.izquierdo + indice * 105;
        return `
            <line x1="${x}" y1="14" x2="${x + 15}" y2="14" stroke="${COLORES_AREAS[indice]}" stroke-width="3" />
            <text x="${x + 19}" y="18" fill="#dfeaf0" font-size="10">${escapar(nombre)}</text>
        `;
    }).join("");

    return `
        <svg class="chart-svg" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escapar(etiqueta)}">
            ${lineasHorizontales}
            ${marcasTiempo}
            ${leyenda}
            ${series}
        </svg>
    `;
};

const crearGraficaPrioridades = (incidentes) => {
    const prioridades = ["P0", "P1", "P2", "P3"];
    const nombres = ["Emergencia", "Alerta crítica", "Advertencia", "Informativo"];
    const valores = prioridades.map((prioridad) =>
        incidentes.filter((incidente) => incidente.prioridad === prioridad).length
    );
    const colores = ["#ff6577", "#f4b942", "#24c8db", "#8ea0aa"];
    const maximo = Math.max(2, ...valores);

    const barras = valores.map((valor, indice) => {
        const x = 45 + indice * 88;
        const altura = (valor / maximo) * 105;
        const y = 132 - altura;
        return `
            <rect x="${x}" y="${y}" width="54" height="${altura}" rx="5" fill="${colores[indice]}" opacity="0.9" />
            <text x="${x + 27}" y="${Math.max(18, y - 8)}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700">${valor}</text>
            <text x="${x + 27}" y="151" text-anchor="middle" fill="#f4f7fb" font-size="10" font-weight="700">${nombres[indice]}</text>
            <text x="${x + 27}" y="166" text-anchor="middle" fill="#a9bbc5" font-size="9">${prioridades[indice]}</text>
        `;
    }).join("");

    return `
        <svg class="chart-svg" viewBox="0 0 390 180" role="img" aria-label="Mensajes agrupados como emergencia, alerta crítica, advertencia e informativo">
            <line x1="27" y1="132" x2="377" y2="132" stroke="#466172" stroke-width="1" />
            ${barras}
        </svg>
    `;
};

export const actualizarGraficasDashboard = ({ hornos, incidentes }, ahora = new Date()) => {
    const contenedores = document.querySelectorAll("section[aria-labelledby='charts-title'] figure > div[role='img']");
    if (contenedores.length < 3) return;

    agregarMuestra(historialTemperatura, hornos.map(({ lectura }) => lectura.temperatura), ahora);
    agregarMuestra(historialKy026, hornos.map(({ lectura }) => lectura.ky026), ahora);
    const nombres = hornos.map(({ area }) => area);

    contenedores[0].innerHTML = crearGraficaTemporal({
        historial: historialTemperatura,
        minimo: 20,
        maximo: 50,
        unidad: "°",
        nombres,
        etiqueta: "Temperatura de los tres hornos durante los últimos segundos"
    });
    contenedores[1].innerHTML = crearGraficaTemporal({
        historial: historialKy026,
        minimo: 0,
        maximo: 100,
        unidad: "%",
        nombres,
        etiqueta: "Lecturas KY-026 de los tres hornos durante los últimos segundos"
    });
    contenedores[2].innerHTML = crearGraficaPrioridades(incidentes);
};
