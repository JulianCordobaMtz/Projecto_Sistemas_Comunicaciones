import { inicializarEncabezado } from "../componentes/encabezado.js";
import { estadoSistema } from "../servicios/datosSimulados.js";
import { eventosHistorial, metricasPruebaPriorizacion } from "../servicios/datosHistorial.js";
import { conectarBackend } from "../servicios/websocket.js";

inicializarEncabezado(estadoSistema);

const EVENTOS_POR_PAGINA = 4;
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
});
const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
});

let paginaActual = 1;
let eventosOperativos = [...eventosHistorial];
let eventoSeleccionadoId = eventosOperativos[0].id;

const formatearHoraSegura = (fecha) => {
    if (!fecha) return "—";
    const valor = new Date(fecha);
    return Number.isNaN(valor.getTime()) ? "—" : FORMATO_HORA.format(valor);
};

const formatearDuracion = (segundos) => {
    const total = Math.max(0, Math.floor(segundos));
    return total >= 60 ? `${Math.floor(total / 60)} min ${total % 60} s` : `${total} s`;
};

const htmlSeguro = (valor) => String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[caracter]));

const convertirIncidenteEnEvento = (incidente, hornos, ahora = new Date()) => {
    const horno = hornos.find(({ id }) => id === incidente.hornoId);
    const inicio = new Date(incidente.inicio);
    const duracionSegundos = Number.isNaN(inicio.getTime()) ? 0 : Math.max(0, Math.floor((ahora - inicio) / 1000));
    const operador = incidente.operadorReconocimiento || "Pendiente";
    const reconocido = Boolean(incidente.reconocidoEn);

    return {
        id: `actual-${incidente.id}`,
        fecha: incidente.inicio,
        prioridad: incidente.prioridad,
        area: horno?.area || "Área no identificada",
        origen: horno ? `${horno.area} · ${horno.nombre}` : "Origen no identificado",
        evento: incidente.titulo || "Incidente activo",
        duracion: formatearDuracion(duracionSegundos),
        duracionSegundos,
        resultado: reconocido ? "Reconocido" : "Activo",
        operador,
        reconocimiento: incidente.reconocidoEn || null,
        finalizacion: incidente.finalizacion || null,
        secuencia: reconocido
            ? ["Incidente detectado.", "Mensaje recibido por la estación central.", `Incidente reconocido por ${operador}.`]
            : ["Incidente detectado.", "Mensaje recibido por la estación central.", "Pendiente de reconocimiento."]
    };
};

const elementos = {
    formulario: document.querySelector("section[aria-labelledby='event-history-title'] form"),
    cuerpoTabla: document.querySelector("section[aria-labelledby='event-history-title'] tbody"),
    textoPaginacion: document.querySelector("section[aria-labelledby='event-history-title'] > footer > p"),
    navegacion: document.querySelector("section[aria-labelledby='event-history-title'] > footer nav"),
    detalle: document.querySelector("section[aria-labelledby='event-detail-title']"),
    banner: document.querySelector(".simulation-banner")
};

const obtenerFiltros = () => ({
    busqueda: document.querySelector("#event-search").value.trim().toLocaleLowerCase("es-MX"),
    prioridad: document.querySelector("#event-priority").value,
    area: document.querySelector("#event-area").value,
    desde: document.querySelector("#event-date-from").value,
    hasta: document.querySelector("#event-date-to").value
});

const filtrarEventos = () => {
    const filtros = obtenerFiltros();
    return eventosOperativos.filter((evento) => {
        const texto = `${evento.origen} ${evento.evento} ${evento.operador}`.toLocaleLowerCase("es-MX");
        const fecha = evento.fecha.slice(0, 10);
        const coincideBusqueda = !filtros.busqueda || texto.includes(filtros.busqueda);
        const coincidePrioridad = filtros.prioridad === "Todas" || evento.prioridad === filtros.prioridad;
        const coincideArea = filtros.area === "Todas las áreas" || filtros.area.startsWith(evento.area);
        const coincideDesde = !filtros.desde || fecha >= filtros.desde;
        const coincideHasta = !filtros.hasta || fecha <= filtros.hasta;
        return coincideBusqueda && coincidePrioridad && coincideArea && coincideDesde && coincideHasta;
    });
};

const nombrePrioridad = (prioridad) => ({
    P0: "Emergencia", P1: "Alerta crítica", P2: "Advertencia", P3: "Informativo", Red: "Red"
}[prioridad] ?? prioridad);

const renderizarDetalle = (evento) => {
    if (!evento) {
        elementos.detalle.hidden = true;
        return;
    }
    elementos.detalle.hidden = false;
    elementos.detalle.querySelector(":scope > header > strong").textContent = evento.resultado;
    const articulos = elementos.detalle.querySelectorAll(":scope > div > article");
    articulos[0].querySelector(":scope > p").textContent = `${nombrePrioridad(evento.prioridad)} (${evento.prioridad})`;
    articulos[0].querySelector("h3").textContent = evento.evento;
    const valores = [
        formatearHoraSegura(evento.fecha),
        formatearHoraSegura(evento.reconocimiento),
        formatearHoraSegura(evento.finalizacion),
        evento.duracion,
        evento.operador
    ];
    articulos[0].querySelectorAll("dd").forEach((dd, indice) => {
        dd.textContent = valores[indice];
    });

    const tiempos = [evento.fecha, evento.fecha, evento.reconocimiento, evento.finalizacion];
    const lista = articulos[1].querySelector("ol");
    lista.innerHTML = evento.secuencia.map((descripcion, indice) => `
        <li>
            <time${tiempos[indice] ? ` datetime="${htmlSeguro(tiempos[indice])}"` : ""}>${formatearHoraSegura(tiempos[indice])}</time>
            <span>${htmlSeguro(descripcion)}</span>
        </li>
    `).join("");
};

const renderizarHistorial = () => {
    const filtrados = filtrarEventos();
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / EVENTOS_POR_PAGINA));
    paginaActual = Math.min(paginaActual, totalPaginas);
    if (!filtrados.some(({ id }) => id === eventoSeleccionadoId)) {
        eventoSeleccionadoId = filtrados[0]?.id ?? null;
    }
    const inicio = (paginaActual - 1) * EVENTOS_POR_PAGINA;
    const visibles = filtrados.slice(inicio, inicio + EVENTOS_POR_PAGINA);

    elementos.cuerpoTabla.innerHTML = visibles.length === 0
        ? `<tr><td colspan="7">No hay eventos que coincidan con los filtros seleccionados.</td></tr>`
        : visibles.map((evento) => `
            <tr data-evento-id="${htmlSeguro(evento.id)}" data-prioridad="${htmlSeguro(evento.prioridad)}">
                <td><time datetime="${htmlSeguro(evento.fecha)}">${FORMATO_FECHA_HORA.format(new Date(evento.fecha))}</time></td>
                <td><strong>${htmlSeguro(nombrePrioridad(evento.prioridad))} <small>(${htmlSeguro(evento.prioridad)})</small></strong></td>
                <td>${htmlSeguro(evento.origen)}</td>
                <td>${htmlSeguro(evento.evento)}</td>
                <td>${htmlSeguro(evento.duracion)}</td>
                <td>${htmlSeguro(evento.resultado)} · ${htmlSeguro(evento.operador)}</td>
                <td><button type="button" data-ver-evento="${htmlSeguro(evento.id)}">Ver</button></td>
            </tr>
        `).join("");

    elementos.textoPaginacion.textContent = `Mostrando ${visibles.length} de ${filtrados.length} eventos`;
    const botones = elementos.navegacion.querySelectorAll("button");
    botones[0].disabled = paginaActual <= 1;
    botones[1].textContent = paginaActual;
    botones[1].setAttribute("aria-label", `Página ${paginaActual} de ${totalPaginas}`);
    botones[2].disabled = paginaActual >= totalPaginas;

    const seleccionado = eventosOperativos.find(({ id }) => id === eventoSeleccionadoId);
    renderizarDetalle(seleccionado);
};

const actualizarResumen = () => {
    const tarjetas = document.querySelectorAll("section[aria-labelledby='history-summary-title'] article");
    const incidentes = eventosOperativos.filter(({ prioridad }) => ["P0", "P1", "P2"].includes(prioridad));
    const fallos = eventosOperativos.filter(({ prioridad }) => prioridad === "Red");
    const emergencias = incidentes.filter(({ prioridad }) => prioridad === "P0").length;
    const alertas = incidentes.length - emergencias;
    const promedioAtencion = Math.round(incidentes.reduce((suma, evento) => suma + evento.duracionSegundos, 0) / incidentes.length);
    tarjetas[0].querySelector("data").value = incidentes.length;
    tarjetas[0].querySelector("data").textContent = incidentes.length;
    tarjetas[0].querySelector("small").textContent = `${emergencias} ${emergencias === 1 ? "emergencia" : "emergencias"} y ${alertas} alertas`;
    tarjetas[1].querySelector("data").value = fallos.length;
    tarjetas[1].querySelector("data").textContent = fallos.length;
    tarjetas[1].querySelector("small").textContent = "Todos recuperados";
    tarjetas[2].querySelector("data").value = promedioAtencion;
    tarjetas[2].querySelector("data").textContent = `${Math.floor(promedioAtencion / 60)} min ${promedioAtencion % 60} s`;
};

const integrarIncidentesActuales = (datos) => {
    const actuales = (datos.incidentes || [])
        .filter(({ estado }) => !["resuelto", "cerrado"].includes(estado))
        .map((incidente) => convertirIncidenteEnEvento(incidente, datos.hornos || []));

    eventosOperativos = [...actuales, ...eventosHistorial];
    renderizarHistorial();
    actualizarResumen();
};

const csvSeguro = (valor) => `"${String(valor).replaceAll('"', '""')}"`;

const exportarCsv = () => {
    const eventos = filtrarEventos();
    const encabezados = ["Fecha", "Prioridad", "Origen", "Evento", "Duración", "Resultado", "Operador"];
    const filas = eventos.map((evento) => [
        evento.fecha, evento.prioridad, evento.origen, evento.evento,
        evento.duracion, evento.resultado, evento.operador
    ]);
    const contenido = [encabezados, ...filas]
        .map((fila) => fila.map(csvSeguro).join(","))
        .join("\r\n");
    const archivo = new Blob(["\uFEFF", contenido], { type: "text/csv;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "historial-operativo-filtrado.csv";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
};

const crearGraficaComparativa = () => {
    const ancho = 620;
    const alto = 190;
    const maximo = Math.max(...metricasPruebaPriorizacion.flatMap(({ conPrioridad, sinPrioridad }) => [conPrioridad, sinPrioridad]));
    const barras = metricasPruebaPriorizacion.map((dato, indice) => {
        const x = 62 + indice * 140;
        const altoCon = (dato.conPrioridad / maximo) * 105;
        const altoSin = (dato.sinPrioridad / maximo) * 105;
        return `
            <rect x="${x}" y="${135 - altoCon}" width="34" height="${altoCon}" rx="4" fill="#24c8db" />
            <rect x="${x + 39}" y="${135 - altoSin}" width="34" height="${altoSin}" rx="4" fill="#8b9aad" />
            <text x="${x + 17}" y="${Math.max(31, 128 - altoCon)}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="700">${dato.conPrioridad} ms</text>
            <text x="${x + 56}" y="${Math.max(31, 128 - altoSin)}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="700">${dato.sinPrioridad} ms</text>
            <text x="${x + 36}" y="153" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700">${dato.nombre}</text>
            <text x="${x + 36}" y="169" text-anchor="middle" fill="#bcd0da" font-size="9">${dato.prioridad}</text>
        `;
    }).join("");
    return `
        <svg class="test-chart" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Comparación de latencia con y sin priorización">
            <line x1="34" y1="135" x2="600" y2="135" stroke="#466172" />
            <rect x="35" y="10" width="12" height="12" fill="#24c8db" /><text x="53" y="20" fill="#dfeaf0" font-size="10">Con prioridad</text>
            <rect x="145" y="10" width="12" height="12" fill="#8b9aad" /><text x="163" y="20" fill="#dfeaf0" font-size="10">Sin prioridad</text>
            ${barras}
        </svg>
    `;
};

const cambiarVista = (mostrarPruebas) => {
    document.querySelector("#history-tab").setAttribute("aria-selected", String(!mostrarPruebas));
    document.querySelector("#tests-tab").setAttribute("aria-selected", String(mostrarPruebas));
    document.querySelector("#history-view").hidden = mostrarPruebas;
    document.querySelector("section[aria-labelledby='event-history-title']").hidden = mostrarPruebas;
    elementos.detalle.hidden = mostrarPruebas || !eventoSeleccionadoId;
    document.querySelector("section[aria-labelledby='controlled-tests-title']").hidden = !mostrarPruebas;
};

const ejecutarPrueba = (tarjeta) => {
    const seccion = document.querySelector("section[aria-labelledby='controlled-tests-title']");
    const botones = seccion.querySelectorAll("article > button");
    const estadoTarjeta = tarjeta.querySelector("header > strong");
    elementos.banner.hidden = false;
    seccion.querySelector(":scope > aside strong").textContent = "Modo simulación: activo";
    document.querySelector("body > div > header > p[role='status']").textContent = "Prueba en ejecución";
    estadoTarjeta.textContent = "Ejecutando…";
    botones.forEach((boton) => { boton.disabled = true; });

    window.setTimeout(() => {
        const ultimaEjecucion = [...tarjeta.querySelectorAll("dl > div")]
            .find((fila) => fila.querySelector("dt")?.textContent === "Última ejecución")
            ?.querySelector("dd");
        if (ultimaEjecucion) ultimaEjecucion.textContent = new Date().toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
        estadoTarjeta.textContent = "Completada";
        botones.forEach((boton) => { boton.disabled = false; });
        seccion.querySelector(":scope > aside strong").textContent = "Modo simulación: inactivo";
        elementos.banner.hidden = true;
        document.querySelector("body > div > header > p[role='status']").textContent = "Registro disponible";
    }, 4000);
};

elementos.formulario.addEventListener("input", () => { paginaActual = 1; renderizarHistorial(); });
elementos.formulario.addEventListener("change", () => { paginaActual = 1; renderizarHistorial(); });
elementos.cuerpoTabla.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-ver-evento]");
    if (!boton) return;
    eventoSeleccionadoId = boton.dataset.verEvento;
    renderizarHistorial();
    elementos.detalle.scrollIntoView({ behavior: "smooth", block: "start" });
});

const botonesPagina = elementos.navegacion.querySelectorAll("button");
botonesPagina[0].addEventListener("click", () => { paginaActual -= 1; renderizarHistorial(); });
botonesPagina[2].addEventListener("click", () => { paginaActual += 1; renderizarHistorial(); });
document.querySelector("section[aria-labelledby='event-history-title'] > header > button").addEventListener("click", exportarCsv);
document.querySelector("#history-tab").addEventListener("click", () => cambiarVista(false));
document.querySelector("#tests-tab").addEventListener("click", () => cambiarVista(true));

const seccionPruebas = document.querySelector("section[aria-labelledby='controlled-tests-title']");
seccionPruebas.querySelector(".test-comparison > div[role='img']").innerHTML = crearGraficaComparativa();
seccionPruebas.querySelectorAll("article > button").forEach((boton) => {
    boton.textContent = "Ejecutar prueba";
    boton.addEventListener("click", () => ejecutarPrueba(boton.closest("article")));
});

actualizarResumen();
renderizarHistorial();
cambiarVista(false);

const desconectarBackend = conectarBackend({ alActualizar: integrarIncidentesActuales });
window.addEventListener("pagehide", desconectarBackend, { once: true });
