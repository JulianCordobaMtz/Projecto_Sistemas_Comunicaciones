import { inicializarEncabezado } from "../componentes/encabezado.js";
import { actualizarGraficasDashboard } from "../componentes/graficaTemperatura.js";
import { actualizarIndicadorIncidentes } from "../componentes/indicadorEstado.js";
import { actualizarTarjetaHorno } from "../componentes/tarjetaHorno.js";
import { estadoSistema, obtenerInstantaneaSistema } from "../servicios/datosSimulados.js";

inicializarEncabezado(estadoSistema);

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const actualizarComunicaciones = (nodos, ahora) => {
    const filas = document.querySelectorAll("section[aria-labelledby='communications-title'] tbody tr");

    filas.forEach((fila, indice) => {
        const nodo = nodos[indice];
        if (!nodo) return;

        const celdas = fila.querySelectorAll("th, td");
        const ultimoDato = new Date(nodo.ultimoDato);
        const edad = Math.max(0, Math.round((ahora - ultimoDato) / 1000));
        const estado = edad >= 15 ? "Sin comunicación" : nodo.rssi <= -75 ? "Degradado" : "Estable";
        const tiempo = celdas[6]?.querySelector("time");

        celdas[1].textContent = estado;
        celdas[2].textContent = `${nodo.rssi} dBm`;
        celdas[3].textContent = `${nodo.latencia} ms`;
        celdas[4].textContent = `${nodo.perdidas.toFixed(1)} %`;
        celdas[5].textContent = nodo.retransmisiones;
        if (tiempo) {
            tiempo.dateTime = ultimoDato.toISOString();
            tiempo.textContent = `Hace ${edad} s`;
        }
    });
};

const actualizarDashboard = () => {
    const ahora = new Date();
    const instantanea = obtenerInstantaneaSistema(ahora);
    const tarjetas = document.querySelectorAll("section[aria-labelledby='areas-title'] article");

    instantanea.hornos.forEach((horno, indice) => {
        const nodo = instantanea.nodos.find(({ id }) => id === horno.nodoId);
        actualizarTarjetaHorno(tarjetas[indice], horno, nodo, ahora);
    });

    const ultimaActualizacion = document.querySelector("section[aria-labelledby='areas-title'] > header time");
    if (ultimaActualizacion) {
        ultimaActualizacion.dateTime = ahora.toISOString();
        ultimaActualizacion.textContent = FORMATO_HORA.format(ahora);
    }

    actualizarIndicadorIncidentes(instantanea.incidentes, instantanea.hornos);
    actualizarGraficasDashboard(instantanea, ahora);
    actualizarComunicaciones(instantanea.nodos, ahora);
};

actualizarDashboard();
window.setInterval(actualizarDashboard, 2000);
