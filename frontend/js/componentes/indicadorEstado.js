const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const ORDEN_PRIORIDAD = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const NOMBRE_PRIORIDAD = Object.freeze({
    P0: "Emergencia",
    P1: "Alerta crítica",
    P2: "Advertencia",
    P3: "Informativo"
});
const ESTADOS_FINALIZADOS = new Set(["resuelto", "cerrado"]);

const normalizarPrioridad = (prioridad) =>
    Object.hasOwn(ORDEN_PRIORIDAD, prioridad) ? prioridad : "P3";

const obtenerFechaInicio = (incidente) => {
    const fecha = new Date(incidente.inicio);
    return Number.isNaN(fecha.getTime()) ? new Date(0) : fecha;
};

const crearElemento = (etiqueta, clase, texto) => {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
};

const formatearEstado = (estado = "activo") => ({
    "sin-atender": "Sin atender",
    reconocida: "Reconocida",
    reconocido: "Reconocido",
    activo: "Activo",
    "en-atencion": "En atención",
    normalizada: "Normalizada"
}[estado] ?? estado.replaceAll("-", " "));

export const obtenerIncidentesActivosOrdenados = (incidentes = []) =>
    incidentes
        .filter(({ estado }) => !ESTADOS_FINALIZADOS.has(estado))
        .slice()
        .sort((a, b) => {
            const diferenciaPrioridad = (ORDEN_PRIORIDAD[a.prioridad] ?? 99) - (ORDEN_PRIORIDAD[b.prioridad] ?? 99);
            return diferenciaPrioridad || obtenerFechaInicio(b) - obtenerFechaInicio(a);
        });

const crearTarjetaIncidente = (incidente, horno) => {
    const prioridad = normalizarPrioridad(incidente.prioridad);
    const esP0 = prioridad === "P0";
    const fechaInicio = obtenerFechaInicio(incidente);
    const tarjeta = crearElemento("article", esP0 ? "emergency-card" : `alert-card priority-${prioridad.toLowerCase()}`);
    const encabezado = crearElemento("header");
    const titulo = crearElemento("div");
    const hora = crearElemento("time", "", fechaInicio.getTime() === 0 ? "Hora no disponible" : FORMATO_HORA.format(fechaInicio));
    const ubicacion = horno ? `${horno.area} · ${horno.nombre}` : "Área no identificada";

    tarjeta.dataset.prioridad = prioridad;
    if (esP0) tarjeta.setAttribute("role", "alert");
    titulo.append(
        crearElemento("p", "", `${prioridad} · ${NOMBRE_PRIORIDAD[prioridad]}`),
        crearElemento("h3", "", incidente.titulo || "Incidente activo")
    );
    if (fechaInicio.getTime() !== 0) hora.dateTime = fechaInicio.toISOString();
    encabezado.append(titulo, hora);

    const detalles = crearElemento("dl", "incident-details");
    [
        ["Prioridad", `${prioridad} · ${NOMBRE_PRIORIDAD[prioridad]}`],
        ["Área", ubicacion],
        ["Causa", incidente.titulo || "Sin causa registrada"],
        ["Estado", formatearEstado(incidente.estado)]
    ].forEach(([etiqueta, valor]) => {
        const fila = crearElemento("div");
        fila.append(crearElemento("dt", "", etiqueta), crearElemento("dd", "", valor));
        detalles.append(fila);
    });

    tarjeta.append(encabezado, detalles);
    if (esP0) {
        const enlace = crearElemento("a", "", "Abrir protocolo de atención");
        enlace.href = "pages/monitoreo.html";
        tarjeta.append(enlace);
    }
    return tarjeta;
};

export const actualizarIndicadorIncidentes = (incidentes, hornos) => {
    const activos = obtenerIncidentesActivosOrdenados(incidentes);
    const emergencias = activos.filter(({ prioridad }) => prioridad === "P0");
    const indicadorGlobal = document.querySelector("body > div > header > p[role='status']");
    const contador = document.querySelector(".incident-panel > header data");
    const lista = document.querySelector(".incident-list");
    const vacio = document.querySelector(".incident-empty");

    if (indicadorGlobal) {
        indicadorGlobal.textContent = emergencias.length === 1
            ? "Una emergencia activa"
            : emergencias.length > 1
                ? `${emergencias.length} emergencias activas`
                : "Sin emergencias activas";
    }

    if (contador) {
        contador.value = activos.length;
        contador.textContent = activos.length === 1 ? "1 incidente" : `${activos.length} incidentes`;
    }

    if (lista) {
        lista.hidden = activos.length === 0;
        lista.replaceChildren(...activos.map((incidente) => {
            const horno = hornos.find(({ id }) => id === incidente.hornoId);
            return crearTarjetaIncidente(incidente, horno);
        }));
    }
    if (vacio) vacio.hidden = activos.length !== 0;
};
