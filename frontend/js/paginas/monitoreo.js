import { actualizarEstadoEncabezado, inicializarEncabezado } from "../componentes/encabezado.js";
import {
    actualizarGraficasMonitoreo,
    registrarMuestrasMonitoreo
} from "../componentes/graficaMonitoreo.js";
import { estadoSistema, obtenerInstantaneaSistema } from "../servicios/datosSimulados.js";
import { conectarBackend } from "../servicios/websocket.js";
import { reconocerIncidente } from "../servicios/api.js";

inicializarEncabezado(estadoSistema);

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const parametrosPagina = new URLSearchParams(window.location.search);
let hornoSeleccionadoId = parametrosPagina.get("horno") || "horno-central";
let lecturaAnterior = null;
let sonidoSilenciado = false;
let intervaloSegundos = 30;
const reconocimientosLocales = new Map();
const inicioAdvertenciaComunicacion = new Date();
const dialogoReconocimiento = document.querySelector("#incident-recognition-dialog");
const formularioReconocimiento = dialogoReconocimiento.querySelector("form");
const campoOperador = dialogoReconocimiento.querySelector("#recognition-operator");
const errorReconocimiento = dialogoReconocimiento.querySelector(".recognition-error");
let incidentePendienteId = null;

const textoNivel = (valor) => {
    if (valor >= 75) return "Alto";
    if (valor >= 30) return "Medio";
    return "Bajo";
};

const textoEstado = (horno, nodo) => {
    if (horno.emergencia || horno.lectura.estado === "critico") return "Crítico";
    if (nodo.rssi <= -75 || horno.lectura.estado === "advertencia") return "Advertencia";
    return "Normal";
};

const buscarValor = (contenedor, etiqueta) => [...contenedor.querySelectorAll("dl > div")]
    .find((fila) => fila.querySelector("dt")?.textContent.trim() === etiqueta)
    ?.querySelector("dd");

const actualizarSelector = (instantanea, ahora) => {
    const botones = document.querySelectorAll("section[aria-labelledby='selector-title'] button");
    const ultimaLectura = document.querySelector("section[aria-labelledby='selector-title'] > header time");

    botones.forEach((boton, indice) => {
        const horno = instantanea.hornos[indice];
        const nodo = instantanea.nodos.find(({ id }) => id === horno.nodoId);
        const estado = textoEstado(horno, nodo);
        const detalle = estado === "Advertencia" && nodo.rssi <= -75
            ? `${estado} · Señal débil (${nodo.rssi} dBm)`
            : `${estado} · ${horno.lectura.temperatura.toFixed(1)} °C`;

        boton.dataset.hornoId = horno.id;
        boton.setAttribute("aria-pressed", String(horno.id === hornoSeleccionadoId));
        boton.querySelector("span").textContent = horno.area;
        boton.querySelector("strong").textContent = horno.nombre;
        boton.querySelector("small").textContent = detalle;
    });

    if (ultimaLectura) {
        ultimaLectura.dateTime = ahora.toISOString();
        ultimaLectura.textContent = FORMATO_HORA.format(ahora);
    }
};

const actualizarResumen = (horno, nodo, ahora) => {
    const seccion = document.querySelector("section[aria-labelledby='selected-area-title']");
    const tarjetas = seccion.querySelectorAll(":scope > div > article");
    const temperatura = tarjetas[0];
    const sensor = tarjetas[1];
    const disponibilidad = tarjetas[2];
    const ultimoDato = new Date(nodo.ultimoDato);
    const edad = Math.max(0, Math.round((ahora - ultimoDato) / 1000));
    const estado = textoEstado(horno, nodo);
    const tendencia = lecturaAnterior === null
        ? "→ Estable"
        : horno.lectura.temperatura > lecturaAnterior
            ? "↑ Aumentando"
            : horno.lectura.temperatura < lecturaAnterior
                ? "↓ Disminuyendo"
                : "→ Estable";

    seccion.querySelector(":scope > header > div > p").textContent = `${horno.area} · ${nodo.nombre}`;
    seccion.querySelector("#selected-area-title").textContent = horno.nombre;
    seccion.querySelector(":scope > header > p[role='status']").textContent = `Estado ${estado.toLocaleLowerCase("es-MX")}`;

    const temperaturaActual = temperatura.querySelector(":scope > p data");
    temperaturaActual.value = horno.lectura.temperatura;
    temperaturaActual.textContent = `${horno.lectura.temperatura.toFixed(1)} °C`;
    temperatura.querySelector(".value-trend").textContent = `${tendencia} · último dato hace ${edad} s`;
    buscarValor(temperatura, "Mínima").textContent = `${horno.temperatura.minima.toFixed(1)} °C`;
    buscarValor(temperatura, "Promedio").textContent = `${horno.temperatura.promedio.toFixed(1)} °C`;
    buscarValor(temperatura, "Máxima").textContent = `${horno.temperatura.maxima.toFixed(1)} °C`;
    buscarValor(temperatura, "Umbral crítico").textContent = `${horno.temperatura.umbralCritico.toFixed(1)} °C`;

    const sensorActual = sensor.querySelector(":scope > p data");
    sensorActual.value = horno.lectura.ky026;
    sensorActual.textContent = `${horno.lectura.ky026} %`;
    sensor.querySelector(".value-explanation").textContent = "Lectura normalizada de 0 a 100 %";
    buscarValor(sensor, "Nivel").textContent = textoNivel(horno.lectura.ky026);
    buscarValor(sensor, "Estado").textContent = horno.lectura.ky026 >= 75 ? "Fuera de rango" : "Dentro de rango";
    buscarValor(sensor, "Umbral").textContent = "75 %";
    buscarValor(sensor, "Última lectura").textContent = `Hace ${edad} s`;

    const operativo = edad < 15;
    const disponibilidadActual = disponibilidad.querySelector(":scope > p data");
    disponibilidadActual.value = operativo ? "operativo" : "sin-comunicacion";
    disponibilidadActual.textContent = operativo ? "Operativo" : "Sin comunicación";
    buscarValor(disponibilidad, "Sensor térmico").textContent = operativo ? "Operativo" : "Sin datos";
    buscarValor(disponibilidad, "KY-026").textContent = operativo ? "Operativo" : "Sin datos";
    const filaNodo = [...disponibilidad.querySelectorAll("dl > div")]
        .find((fila) => fila.querySelector("dt")?.textContent.startsWith("Nodo"));
    filaNodo.querySelector("dt").textContent = nodo.nombre;
    filaNodo.querySelector("dd").textContent = operativo ? (nodo.rssi <= -75 ? "Señal débil" : "Conectado") : "Sin comunicación";
    buscarValor(disponibilidad, "Último paquete").textContent = `Hace ${edad} s`;

    lecturaAnterior = horno.lectura.temperatura;
};

const actualizarIncidente = (horno, nodo, incidentes, ahora) => {
    const seccion = document.querySelector("section[aria-labelledby='active-condition-title']");
    const articulo = seccion.querySelector("article[role='alert']");
    const vacio = seccion.querySelector(".incident-empty");
    const incidenteRegistrado = incidentes
        .filter(({ hornoId }) => hornoId === horno.id)
        .sort((a, b) => a.prioridad.localeCompare(b.prioridad))[0];
    const advertenciaComunicacion = nodo.rssi <= -75 ? {
        id: `advertencia-${nodo.id}`,
        prioridad: "P2",
        tipo: "comunicacion",
        hornoId: horno.id,
        titulo: "Señal débil",
        estado: "activo",
        inicio: inicioAdvertenciaComunicacion.toISOString()
    } : null;
    const incidente = incidenteRegistrado ?? advertenciaComunicacion;
    const esComunicacion = incidente?.tipo === "comunicacion";

    articulo.hidden = !incidente;
    vacio.hidden = Boolean(incidente);
    seccion.classList.toggle("communication-warning", Boolean(esComunicacion));
    if (!incidente) {
        seccion.querySelector(":scope > header time").textContent = "Sin eventos pendientes";
        return;
    }

    const reconocimientoLocal = esComunicacion ? reconocimientosLocales.get(incidente.id) : null;
    const reconocidoEn = esComunicacion
        ? reconocimientoLocal?.fecha
        : incidente.reconocidoEn ? new Date(incidente.reconocidoEn) : null;
    const operadorReconocimiento = esComunicacion
        ? reconocimientoLocal?.operador
        : incidente.operadorReconocimiento;
    const inicio = new Date(incidente.inicio);
    const tiempoActivo = Math.max(0, Math.floor((ahora - inicio) / 1000));
    const tiempoReconocido = reconocidoEn ? Math.max(0, Math.floor((ahora - reconocidoEn) / 1000)) : null;
    const prioridadTexto = incidente.prioridad === "P0"
        ? "P0 · Atención inmediata"
        : incidente.prioridad === "P1"
            ? "P1 · Alerta crítica"
            : "P2 · Advertencia de comunicación";
    const horaDeteccion = seccion.querySelector(":scope > header time");

    horaDeteccion.dateTime = inicio.toISOString();
    horaDeteccion.textContent = `Detectado a las ${FORMATO_HORA.format(inicio)}`;
    articulo.dataset.incidenteId = incidente.id;
    articulo.querySelector("header p").textContent = prioridadTexto;
    articulo.querySelector("header h3").textContent = `${incidente.tipo === "emergencia" ? "Emergencia activa" : incidente.titulo} en ${horno.nombre.toLocaleLowerCase("es-MX")}`;
    articulo.querySelector("header strong").textContent = reconocidoEn
        ? "Reconocida"
        : esComunicacion ? "Advertencia activa" : "Activa sin reconocer";

    const campos = articulo.querySelectorAll("dl > div");
    const etiquetas = esComunicacion
        ? ["RSSI actual", "Umbral recomendado", "Tiempo activo", "Desde reconocimiento"]
        : ["Temperatura", "Límite", "Tiempo activo", "Desde reconocimiento"];
    const valores = esComunicacion
        ? [`${nodo.rssi} dBm`, "−70 dBm", `${tiempoActivo} s`, tiempoReconocido === null ? "—" : `${tiempoReconocido} s`]
        : [`${horno.lectura.temperatura.toFixed(1)} °C`, `${horno.temperatura.umbralCritico.toFixed(1)} °C`, `${tiempoActivo} s`, tiempoReconocido === null ? "—" : `${tiempoReconocido} s`];

    campos.forEach((campo, indice) => {
        campo.querySelector("dt").textContent = etiquetas[indice];
        campo.querySelector("dd").textContent = valores[indice];
    });

    const pasos = articulo.querySelectorAll(".alarm-lifecycle li");
    if (reconocidoEn) {
        pasos[0].removeAttribute("aria-current");
        pasos[1].setAttribute("aria-current", "step");
    } else {
        pasos[0].setAttribute("aria-current", "step");
        pasos[1].removeAttribute("aria-current");
    }
    const botonReconocer = articulo.querySelector("footer button:first-of-type");
    botonReconocer.disabled = Boolean(reconocidoEn);
    botonReconocer.textContent = reconocidoEn
        ? `Reconocido por ${operadorReconocimiento || "operador"}`
        : "Reconocer incidente";
    const botonSonido = articulo.querySelector("footer button:nth-of-type(2)");
    botonSonido.hidden = esComunicacion;
    botonSonido.textContent = sonidoSilenciado ? "Activar sonido" : "Silenciar sonido";
};

const actualizarEncabezadoEmergencia = (incidentes) => {
    const emergencias = incidentes.filter(({ prioridad, estado }) => prioridad === "P0" && !["resuelto", "cerrado"].includes(estado));
    const sinReconocer = emergencias.filter(({ estado }) => !["reconocido", "reconocida"].includes(estado));
    const indicador = document.querySelector("body > div > header > p[role='status']");

    indicador.dataset.emergencyState = sinReconocer.length > 0
        ? "unrecognized"
        : emergencias.length > 0 ? "recognized" : "none";
    indicador.textContent = sinReconocer.length === 1
        ? "Una emergencia activa"
        : sinReconocer.length > 1
            ? `${sinReconocer.length} emergencias activas`
            : emergencias.length === 1
                ? "Emergencia reconocida"
                : emergencias.length > 1
                    ? `${emergencias.length} emergencias reconocidas`
                    : "Sin emergencias activas";
};

const actualizarPagina = () => {
    const ahora = new Date();
    const instantanea = obtenerInstantaneaSistema(ahora);
    const horno = instantanea.hornos.find(({ id }) => id === hornoSeleccionadoId);
    const nodo = instantanea.nodos.find(({ id }) => id === horno.nodoId);

    registrarMuestrasMonitoreo(instantanea.hornos, ahora);
    actualizarSelector(instantanea, ahora);
    actualizarResumen(horno, nodo, ahora);
    actualizarGraficasMonitoreo(horno, intervaloSegundos);
    actualizarIncidente(horno, nodo, instantanea.incidentes, ahora);
    actualizarEncabezadoEmergencia(instantanea.incidentes);
    document.querySelector("#trends-title").textContent = `Tendencias de ${horno.nombre.toLocaleLowerCase("es-MX")}`;
};

document.querySelector("section[aria-labelledby='selector-title'] [role='group']")
    .addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-horno-id]");
        if (!boton) return;
        hornoSeleccionadoId = boton.dataset.hornoId;
        lecturaAnterior = null;
        actualizarPagina();
    });

const articuloIncidente = document.querySelector("section[aria-labelledby='active-condition-title'] article");
articuloIncidente.querySelector("footer button:first-of-type").addEventListener("click", async (evento) => {
    const incidenteId = articuloIncidente.dataset.incidenteId;
    if (!incidenteId) return;
    incidentePendienteId = incidenteId;
    formularioReconocimiento.reset();
    errorReconocimiento.hidden = true;
    dialogoReconocimiento.showModal();
    campoOperador.focus();
});

dialogoReconocimiento.querySelector("[data-cancelar-reconocimiento]").addEventListener("click", () => {
    incidentePendienteId = null;
    dialogoReconocimiento.close();
});

formularioReconocimiento.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const operador = campoOperador.value.trim();
    if (!incidentePendienteId || !operador) return;

    const botonConfirmar = formularioReconocimiento.querySelector("button[type='submit']");
    botonConfirmar.disabled = true;
    botonConfirmar.textContent = "Reconociendo…";
    errorReconocimiento.hidden = true;

    try {
        if (incidentePendienteId.startsWith("advertencia-")) {
            reconocimientosLocales.set(incidentePendienteId, { fecha: new Date(), operador });
        } else {
            await reconocerIncidente(incidentePendienteId, operador);
        }
        incidentePendienteId = null;
        dialogoReconocimiento.close();
        actualizarPagina();
    } catch (error) {
        errorReconocimiento.textContent = `No fue posible reconocer el incidente: ${error.message}`;
        errorReconocimiento.hidden = false;
    } finally {
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = "Confirmar reconocimiento";
    }
});

articuloIncidente.querySelector("footer button:nth-of-type(2)").addEventListener("click", () => {
    sonidoSilenciado = !sonidoSilenciado;
    actualizarPagina();
});

document.querySelector("#time-range").addEventListener("change", (evento) => {
    intervaloSegundos = Number(evento.target.value);
    actualizarPagina();
});

actualizarPagina();
window.setInterval(actualizarPagina, 2000);
const desconectarBackend = conectarBackend({
    alActualizar: actualizarPagina,
    alCambiarEstado: actualizarEstadoEncabezado
});
window.addEventListener("pagehide", desconectarBackend, { once: true });
