import { actualizarEstadoEncabezado, inicializarEncabezado } from "../componentes/encabezado.js";
import {
    actualizarGraficaRed,
    registrarMuestraRed
} from "../componentes/graficaComunicaciones.js";
import { estadoSistema, obtenerInstantaneaSistema } from "../servicios/datosSimulados.js";
import { conectarBackend } from "../servicios/websocket.js";

inicializarEncabezado(estadoSistema);

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const inicioCondicionRed = new Date();
let nodoSeleccionadoId = "nodo-03";
let metricaSeleccionada = "rssi";

const estadoNodo = (nodo, ahora) => {
    const ultimoDato = new Date(nodo.ultimoDato);
    const edad = Math.max(0, Math.round((ahora - ultimoDato) / 1000));
    if (edad >= 15) return { clave: "sin-comunicacion", texto: "Sin comunicación", edad };
    if (nodo.rssi <= -75) return { clave: "degradado", texto: "Señal débil", edad };
    if (nodo.estado === "degradado") return { clave: "degradado", texto: "Degradado", edad };
    return { clave: "estable", texto: "Estable", edad };
};

const promedio = (valores) => valores.reduce((total, valor) => total + valor, 0) / valores.length;

const actualizarResumen = (nodos, ahora) => {
    const seccion = document.querySelector("section[aria-labelledby='network-status-title']");
    const tarjetas = seccion.querySelectorAll(":scope > div > article");
    const estados = nodos.map((nodo) => estadoNodo(nodo, ahora));
    const disponibles = estados.filter(({ clave }) => clave !== "sin-comunicacion").length;
    const degradados = estados.filter(({ clave }) => clave !== "estable").length;
    const latenciaPromedio = promedio(nodos.map(({ latencia }) => latencia));
    const perdidaPromedio = promedio(nodos.map(({ perdidas }) => perdidas));
    const estadoGeneral = degradados > 0 ? "Degradado" : "Estable";

    tarjetas[0].querySelector("strong").textContent = estadoGeneral;
    tarjetas[0].querySelector("small").textContent = degradados > 0
        ? `${degradados} nodo${degradados === 1 ? "" : "s"} requiere${degradados === 1 ? "" : "n"} revisión`
        : "Todos los enlaces operan normalmente";
    const nodosDisponibles = tarjetas[1].querySelector("data");
    nodosDisponibles.value = disponibles;
    nodosDisponibles.textContent = `${disponibles} de ${nodos.length}`;
    tarjetas[1].querySelector("small").textContent = disponibles === nodos.length
        ? "Todos reportan información"
        : "Existe un nodo sin comunicación";
    const latencia = tarjetas[2].querySelector("data");
    latencia.value = latenciaPromedio.toFixed(1);
    latencia.textContent = `${latenciaPromedio.toFixed(1)} ms`;
    tarjetas[2].querySelector("small").textContent = latenciaPromedio <= 100
        ? "Dentro del rango operativo"
        : "Fuera del rango recomendado";
    const perdidas = tarjetas[3].querySelector("data");
    perdidas.value = perdidaPromedio.toFixed(1);
    perdidas.textContent = `${perdidaPromedio.toFixed(1)} %`;
    const peorNodo = [...nodos].sort((a, b) => b.perdidas - a.perdidas)[0];
    tarjetas[3].querySelector("small").textContent = perdidaPromedio > 1
        ? `Mayor pérdida en ${peorNodo.nombre}`
        : "Dentro del rango operativo";

    const ultimaActualizacion = seccion.querySelector(":scope > header time");
    ultimaActualizacion.dateTime = ahora.toISOString();
    ultimaActualizacion.textContent = FORMATO_HORA.format(ahora);

    const estadoEncabezado = document.querySelector("body > div > header > p[role='status']");
    estadoEncabezado.textContent = estadoGeneral === "Estable" ? "Red estable" : "Red degradada";
};

const actualizarCongestion = (nodos, ahora) => {
    const seccion = document.querySelector("section[aria-labelledby='congestion-title']");
    const lista = seccion.querySelector(".network-condition-list");
    const vacio = seccion.querySelector(".network-condition-empty");
    const afectados = nodos.map((nodo) => ({ nodo, estado: estadoNodo(nodo, ahora) }))
        .filter(({ estado }) => estado.clave !== "estable");
    const contador = seccion.querySelector(":scope > header > p[role='status']");

    contador.textContent = `${afectados.length} ${afectados.length === 1 ? "condición activa" : "condiciones activas"}`;
    lista.hidden = afectados.length === 0;
    vacio.hidden = afectados.length !== 0;

    const tarjetas = afectados.map(({ nodo, estado }) => {
        const horno = estadoSistema.hornos.find(({ nodoId }) => nodoId === nodo.id);
        const sinComunicacion = estado.clave === "sin-comunicacion";
        const articulo = document.createElement("article");
        const encabezado = document.createElement("header");
        const titulo = document.createElement("div");
        const categoria = document.createElement("p");
        const nombre = document.createElement("h3");
        const tiempo = document.createElement("time");
        const descripcion = document.createElement("p");
        const detalles = document.createElement("dl");
        const fechaCondicion = sinComunicacion
            ? new Date(new Date(nodo.ultimoDato).getTime() + 15_000)
            : inicioCondicionRed;

        articulo.dataset.estado = estado.clave;
        if (sinComunicacion) articulo.setAttribute("role", "alert");
        categoria.textContent = sinComunicacion ? "Falla de comunicación" : "Advertencia de red";
        nombre.textContent = sinComunicacion
            ? `Sin comunicación con ${nodo.nombre}`
            : `Enlace degradado en ${nodo.nombre}`;
        tiempo.dateTime = fechaCondicion.toISOString();
        tiempo.textContent = FORMATO_HORA.format(fechaCondicion);
        descripcion.textContent = sinComunicacion
            ? `El nodo no entrega telemetría desde hace ${estado.edad} segundos. La última lectura se conserva hasta recuperar el enlace.`
            : "La señal o las métricas de transmisión están fuera del rango recomendado; el nodo continúa enviando información.";
        titulo.append(categoria, nombre);
        encabezado.append(titulo, tiempo);

        [
            ["Origen", `${nodo.nombre} · ${horno.area}`],
            ["Estado", estado.texto],
            ["RSSI", `${nodo.rssi} dBm`],
            ["Último paquete", `Hace ${estado.edad} s`]
        ].forEach(([etiqueta, valor]) => {
            const fila = document.createElement("div");
            const termino = document.createElement("dt");
            const dato = document.createElement("dd");
            termino.textContent = etiqueta;
            dato.textContent = valor;
            fila.append(termino, dato);
            detalles.append(fila);
        });
        articulo.append(encabezado, descripcion, detalles);
        return articulo;
    });
    lista.replaceChildren(...tarjetas);
};

const actualizarTopologia = (nodos, ahora) => {
    const botones = document.querySelectorAll("section[aria-labelledby='topology-title'] div[role='group'] button");
    botones.forEach((boton, indice) => {
        const nodo = nodos[indice];
        const horno = estadoSistema.hornos.find(({ nodoId }) => nodoId === nodo.id);
        const estado = estadoNodo(nodo, ahora);
        boton.dataset.nodoId = nodo.id;
        boton.dataset.estado = estado.clave;
        boton.setAttribute("aria-pressed", String(nodo.id === nodoSeleccionadoId));
        boton.querySelector("span").textContent = nodo.nombre;
        boton.querySelector("strong").textContent = horno.nombre;
        boton.querySelector("small").textContent = `${estado.texto} · ${nodo.rssi} dBm`;
    });
};

const buscarDetalle = (seccion, etiqueta) => [...seccion.querySelectorAll("dl > div")]
    .find((fila) => fila.querySelector("dt")?.textContent.trim() === etiqueta)
    ?.querySelector("dd");

const actualizarDetalleNodo = (nodo, ahora) => {
    const seccion = document.querySelector("section[aria-labelledby='selected-node-title']");
    const horno = estadoSistema.hornos.find(({ nodoId }) => nodoId === nodo.id);
    const estado = estadoNodo(nodo, ahora);
    const textos = {
        estable: {
            titulo: "Enlace estable",
            descripcion: "El nodo transmite dentro de los parámetros esperados y no requiere intervención.",
            recomendacion: "Continuar con la supervisión normal del enlace."
        },
        degradado: {
            titulo: "Enlace degradado",
            descripcion: "La intensidad de señal está por debajo del rango recomendado. El nodo continúa transmitiendo, pero requiere supervisión.",
            recomendacion: "Revisar la ubicación del nodo, posibles obstáculos y la conexión de la antena."
        },
        "sin-comunicacion": {
            titulo: "Sin comunicación",
            descripcion: "El nodo dejó de entregar datos dentro del tiempo permitido.",
            recomendacion: "Revisar alimentación, antena y disponibilidad física del nodo."
        }
    }[estado.clave];

    seccion.dataset.estado = estado.clave;
    seccion.querySelector("#selected-node-title").textContent = `${nodo.nombre} · ${horno.nombre}`;
    seccion.querySelector(":scope > header > strong").textContent = textos.titulo;
    seccion.querySelector(":scope > p").textContent = textos.descripcion;
    buscarDetalle(seccion, "Intensidad RSSI").textContent = `${nodo.rssi} dBm`;
    buscarDetalle(seccion, "Latencia").textContent = `${nodo.latencia} ms`;
    buscarDetalle(seccion, "Pérdidas").textContent = `${nodo.perdidas.toFixed(1)} %`;
    buscarDetalle(seccion, "Retransmisiones").textContent = nodo.retransmisiones;
    buscarDetalle(seccion, "Último paquete").textContent = `Hace ${estado.edad} s`;
    buscarDetalle(seccion, "Mensajes críticos pendientes").textContent = "0";
    seccion.querySelector(":scope > aside p").textContent = textos.recomendacion;
};

const actualizarPagina = () => {
    const ahora = new Date();
    const instantanea = obtenerInstantaneaSistema(ahora);
    const nodo = instantanea.nodos.find(({ id }) => id === nodoSeleccionadoId);

    registrarMuestraRed(instantanea.nodos, ahora);
    actualizarResumen(instantanea.nodos, ahora);
    actualizarCongestion(instantanea.nodos, ahora);
    actualizarTopologia(instantanea.nodos, ahora);
    actualizarDetalleNodo(nodo, ahora);
    actualizarGraficaRed(nodo, metricaSeleccionada);

    const encabezadoGrafica = document.querySelector("section[aria-labelledby='channel-trend-title'] > header > div:first-child > p");
    encabezadoGrafica.textContent = `${nodo.nombre} · Últimos 30 segundos`;
};

document.querySelector("section[aria-labelledby='topology-title'] div[role='group']")
    .addEventListener("click", (evento) => {
        const boton = evento.target.closest("button[data-nodo-id]");
        if (!boton) return;
        nodoSeleccionadoId = boton.dataset.nodoId;
        actualizarPagina();
    });

const selectorMetricas = document.querySelector("section[aria-labelledby='channel-trend-title'] div[role='group']");
const mapaMetricas = ["rssi", "latencia", "perdidas", "retransmisiones"];
selectorMetricas.querySelectorAll("button").forEach((boton, indice) => {
    boton.dataset.metrica = mapaMetricas[indice];
});
selectorMetricas.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-metrica]");
    if (!boton) return;
    metricaSeleccionada = boton.dataset.metrica;
    selectorMetricas.querySelectorAll("button").forEach((opcion) =>
        opcion.setAttribute("aria-pressed", String(opcion === boton))
    );
    actualizarPagina();
});

actualizarPagina();
window.setInterval(actualizarPagina, 2000);
const desconectarBackend = conectarBackend({
    alActualizar: actualizarPagina,
    alCambiarEstado: actualizarEstadoEncabezado
});
window.addEventListener("pagehide", desconectarBackend, { once: true });
