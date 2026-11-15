const MAXIMO_MUESTRAS = 15;
const historiales = new Map();

const CONFIGURACION = Object.freeze({
    rssi: { titulo: "Intensidad de señal RSSI", unidad: "dBm", minimo: -100, maximo: -40, umbral: -70 },
    latencia: { titulo: "Latencia del enlace", unidad: "ms", minimo: 0, maximo: 150, umbral: 100 },
    perdidas: { titulo: "Pérdida de paquetes", unidad: "%", minimo: 0, maximo: 10, umbral: 5 },
    retransmisiones: { titulo: "Retransmisiones", unidad: "", minimo: 0, maximo: 10, umbral: 5 }
});

const obtenerHistorial = (nodoId) => {
    if (!historiales.has(nodoId)) historiales.set(nodoId, []);
    return historiales.get(nodoId);
};

export const registrarMuestraRed = (nodos, ahora = new Date()) => {
    nodos.forEach((nodo) => {
        const historial = obtenerHistorial(nodo.id);
        historial.push({
            tiempo: ahora,
            rssi: nodo.rssi,
            latencia: nodo.latencia,
            perdidas: nodo.perdidas,
            retransmisiones: nodo.retransmisiones
        });
        if (historial.length > MAXIMO_MUESTRAS) historial.shift();
    });
};

const crearSvg = (muestras, metrica, nodo) => {
    const config = CONFIGURACION[metrica];
    const ancho = 900;
    const alto = 285;
    const margen = { superior: 24, derecho: 34, inferior: 45, izquierdo: 62 };
    const anchoUtil = ancho - margen.izquierdo - margen.derecho;
    const altoUtil = alto - margen.superior - margen.inferior;
    const x = (indice) => margen.izquierdo + (indice / (MAXIMO_MUESTRAS - 1)) * anchoUtil;
    const y = (valor) => margen.superior + (1 - (valor - config.minimo) / (config.maximo - config.minimo)) * altoUtil;
    const desplazamiento = MAXIMO_MUESTRAS - muestras.length;
    const puntos = muestras.map((muestra, indice) => ({
        x: x(indice + desplazamiento),
        y: y(muestra[metrica]),
        valor: muestra[metrica]
    }));
    const niveles = Array.from({ length: 5 }, (_, indice) =>
        config.minimo + ((config.maximo - config.minimo) * indice) / 4
    );

    const cuadricula = niveles.map((nivel) => `
        <line x1="${margen.izquierdo}" y1="${y(nivel)}" x2="${ancho - margen.derecho}" y2="${y(nivel)}" stroke="#294354" />
        <text x="${margen.izquierdo - 9}" y="${y(nivel) + 4}" text-anchor="end" fill="#a9bbc5" font-size="11">${Number.isInteger(nivel) ? nivel : nivel.toFixed(1)}</text>
    `).join("");
    const tiempos = [0, 5, 10, 14].map((indice) => `
        <line x1="${x(indice)}" y1="${margen.superior}" x2="${x(indice)}" y2="${alto - margen.inferior}" stroke="#203746" />
        <text x="${x(indice)}" y="${alto - 19}" text-anchor="middle" fill="#a9bbc5" font-size="11">${indice === 14 ? "ahora" : `${(indice - 14) * 2} s`}</text>
    `).join("");
    const linea = puntos.map((punto) => `${punto.x},${punto.y}`).join(" ");
    const circulos = puntos.map((punto) =>
        `<circle cx="${punto.x}" cy="${punto.y}" r="3.8" fill="#24c8db" />`
    ).join("");
    const ultimo = puntos.at(-1);

    return `
        <svg class="network-chart" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${config.titulo} de ${nodo.nombre}">
            ${cuadricula}
            ${tiempos}
            <line x1="${margen.izquierdo}" y1="${y(config.umbral)}" x2="${ancho - margen.derecho}" y2="${y(config.umbral)}" stroke="#f4b942" stroke-width="2" stroke-dasharray="8 6" />
            <text x="${ancho - margen.derecho}" y="${y(config.umbral) - 8}" text-anchor="end" fill="#f4b942" font-size="11" font-weight="700">Umbral ${config.umbral} ${config.unidad}</text>
            <polyline points="${linea}" fill="none" stroke="#24c8db" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            ${circulos}
            ${ultimo ? `<text x="${ultimo.x - 7}" y="${Math.max(15, ultimo.y - 10)}" text-anchor="end" fill="#ffffff" font-size="12" font-weight="700">${ultimo.valor} ${config.unidad}</text>` : ""}
        </svg>
    `;
};

export const actualizarGraficaRed = (nodo, metrica) => {
    const figura = document.querySelector("section[aria-labelledby='channel-trend-title'] figure");
    const config = CONFIGURACION[metrica];
    if (!figura || !nodo || !config) return;

    figura.querySelector("h3").textContent = config.titulo;
    figura.querySelector("figcaption p").textContent = `Historial del enlace entre la estación central y ${nodo.nombre}`;
    figura.querySelector("figcaption strong").textContent = `Actual: ${nodo[metrica]} ${config.unidad}`;
    figura.querySelector("div[role='img']").innerHTML = crearSvg(obtenerHistorial(nodo.id), metrica, nodo);
};
