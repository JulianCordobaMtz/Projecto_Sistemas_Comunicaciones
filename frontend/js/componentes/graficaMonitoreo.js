const MAXIMO_MUESTRAS = 31;
const COLOR_DATO = "#24c8db";
const COLOR_UMBRAL = "#ff6577";
const historiales = new Map();

const obtenerHistorial = (hornoId) => {
    if (!historiales.has(hornoId)) {
        historiales.set(hornoId, { temperatura: [], ky026: [] });
    }
    return historiales.get(hornoId);
};

const agregar = (lista, muestra) => {
    lista.push(muestra);
    if (lista.length > MAXIMO_MUESTRAS) lista.shift();
};

export const registrarMuestrasMonitoreo = (hornos, ahora = new Date()) => {
    hornos.forEach((horno) => {
        if (horno.estadoHorno === "fuera-de-operacion") return;
        const historial = obtenerHistorial(horno.id);
        agregar(historial.temperatura, { tiempo: ahora, valor: horno.lectura.temperatura });
        agregar(historial.ky026, { tiempo: ahora, valor: horno.lectura.ky026 });
    });
};

const crearGrafica = ({ muestras, minimo, maximo, umbral, unidad, etiqueta, periodoSegundos }) => {
    const ancho = 620;
    const alto = 230;
    const margen = { superior: 22, derecho: 28, inferior: 42, izquierdo: 48 };
    const anchoUtil = ancho - margen.izquierdo - margen.derecho;
    const altoUtil = alto - margen.superior - margen.inferior;
    const cantidadVisible = Math.floor(periodoSegundos / 2) + 1;
    const muestrasVisibles = muestras.slice(-cantidadVisible);
    const ultimoIndice = cantidadVisible - 1;
    const x = (indice) => margen.izquierdo + (indice / ultimoIndice) * anchoUtil;
    const y = (valor) => margen.superior + (1 - (valor - minimo) / (maximo - minimo)) * altoUtil;
    const desplazamiento = cantidadVisible - muestrasVisibles.length;
    const puntos = muestrasVisibles.map((muestra, indice) => ({
        x: x(indice + desplazamiento),
        y: y(muestra.valor),
        valor: muestra.valor
    }));
    const ultimo = puntos.at(-1);
    const niveles = Array.from({ length: 5 }, (_, indice) => minimo + ((maximo - minimo) * indice) / 4);

    const cuadricula = niveles.map((nivel) => `
        <line x1="${margen.izquierdo}" y1="${y(nivel)}" x2="${ancho - margen.derecho}" y2="${y(nivel)}" stroke="#294354" />
        <text x="${margen.izquierdo - 8}" y="${y(nivel) + 4}" text-anchor="end" fill="#a9bbc5" font-size="10">${Math.round(nivel)}${unidad}</text>
    `).join("");

    const indicesTiempo = [0, Math.round(ultimoIndice / 3), Math.round((ultimoIndice * 2) / 3), ultimoIndice];
    const tiempos = indicesTiempo.map((indice) => `
        <line x1="${x(indice)}" y1="${margen.superior}" x2="${x(indice)}" y2="${alto - margen.inferior}" stroke="#203746" />
        <text x="${x(indice)}" y="${alto - 19}" text-anchor="middle" fill="#a9bbc5" font-size="10">${indice === ultimoIndice ? "ahora" : `${(indice - ultimoIndice) * 2} s`}</text>
    `).join("");

    const linea = puntos.map((punto) => `${punto.x},${punto.y}`).join(" ");
    const circulos = puntos.map((punto) =>
        `<circle cx="${punto.x}" cy="${punto.y}" r="3.2" fill="${COLOR_DATO}" />`
    ).join("");

    return `
        <svg class="monitoring-chart" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${etiqueta}">
            ${cuadricula}
            ${tiempos}
            <line x1="${margen.izquierdo}" y1="${y(umbral)}" x2="${ancho - margen.derecho}" y2="${y(umbral)}" stroke="${COLOR_UMBRAL}" stroke-width="2" stroke-dasharray="7 5" />
            <text x="${ancho - margen.derecho}" y="${y(umbral) - 7}" text-anchor="end" fill="${COLOR_UMBRAL}" font-size="10" font-weight="700">Umbral ${umbral}${unidad}</text>
            <polyline points="${linea}" fill="none" stroke="${COLOR_DATO}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            ${circulos}
            ${ultimo ? `<text x="${ultimo.x - 7}" y="${Math.max(15, ultimo.y - 10)}" text-anchor="end" fill="#ffffff" font-size="12" font-weight="700">${ultimo.valor}${unidad}</text>` : ""}
        </svg>
    `;
};

export const actualizarGraficasMonitoreo = (horno, periodoSegundos = 30) => {
    const contenedores = document.querySelectorAll("section[aria-labelledby='trends-title'] figure > div[role='img']");
    if (!horno || contenedores.length < 2) return;

    if (horno.estadoHorno === "fuera-de-operacion") {
        contenedores.forEach((contenedor) => {
            contenedor.innerHTML = "<p>Horno fuera de operación · No se registran muestras operativas</p>";
        });
        return;
    }

    const historial = obtenerHistorial(horno.id);
    contenedores[0].innerHTML = crearGrafica({
        muestras: historial.temperatura,
        minimo: 20,
        maximo: 50,
        umbral: horno.temperatura.umbralCritico,
        unidad: "°",
        etiqueta: `Evolución de temperatura de ${horno.nombre}`,
        periodoSegundos
    });
    contenedores[1].innerHTML = crearGrafica({
        muestras: historial.ky026,
        minimo: 0,
        maximo: 100,
        umbral: 75,
        unidad: "%",
        etiqueta: `Evolución del sensor KY-026 de ${horno.nombre}`,
        periodoSegundos
    });
};
