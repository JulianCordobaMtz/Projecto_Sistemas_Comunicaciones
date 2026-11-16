import { EventEmitter } from "node:events";
import { crearEstadoInicial } from "../datos/estadoInicial.js";

const redondear = (valor, decimales = 1) => Number(valor.toFixed(decimales));
const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

class EstadoSistema extends EventEmitter {
    #estado = crearEstadoInicial();
    #simulacionActiva = true;

    constructor() {
        super();
    }

    obtenerEstado() {
        return structuredClone(this.#estado);
    }

    obtenerHornos() {
        return structuredClone(this.#estado.hornos);
    }

    obtenerNodos() {
        return structuredClone(this.#estado.nodos);
    }

    obtenerIncidentes() {
        return structuredClone(this.#estado.incidentes);
    }

    obtenerModo() {
        return {
            modo: this.#simulacionActiva ? "simulacion" : "datos-externos",
            etiqueta: this.#estado.sistema.modo,
            simulacionActiva: this.#simulacionActiva
        };
    }

    existeNodo(nodoId) {
        return this.#estado.nodos.some(({ id }) => id === nodoId);
    }

    actualizarCola(resumenCola) {
        this.#estado.cola = structuredClone(resumenCola.prioridades);
        this.#estado.sistema.actualizadoEn = new Date().toISOString();
        return this.#publicarActualizacion();
    }

    cambiarModo(modo) {
        this.#simulacionActiva = modo === "simulacion";
        this.#estado.sistema.modo = this.#simulacionActiva ? "Simulación" : "Datos externos";
        this.#estado.sistema.actualizadoEn = new Date().toISOString();

        if (this.#simulacionActiva) {
            this.#estado.nodos = this.#estado.nodos.map((nodo) => ({
                ...nodo,
                ultimoDato: this.#estado.sistema.actualizadoEn
            }));
        }

        return this.#publicarActualizacion();
    }

    reconocerIncidente(incidenteId, operador) {
        const incidente = this.#obtenerIncidenteEditable(incidenteId);
        if (incidente.estado === "resuelto") {
            const error = new Error("No se puede reconocer un incidente resuelto");
            error.estadoHttp = 409;
            throw error;
        }

        if (incidente.estado !== "reconocido") {
            incidente.estado = "reconocido";
            incidente.reconocidoEn = new Date().toISOString();
            incidente.operadorReconocimiento = operador;
        }

        return this.#publicarActualizacion();
    }

    cerrarIncidente(incidenteId, operador) {
        const incidente = this.#obtenerIncidenteEditable(incidenteId);
        if (incidente.estado !== "resuelto") {
            const finalizacion = new Date();
            incidente.estado = "resuelto";
            incidente.finalizacion = finalizacion.toISOString();
            incidente.operadorCierre = operador;
            incidente.duracionSegundos = Math.max(0, Math.floor((finalizacion - new Date(incidente.inicio)) / 1000));
        }

        return this.#publicarActualizacion();
    }

    #obtenerIncidenteEditable(incidenteId) {
        const incidente = this.#estado.incidentes.find(({ id }) => id === incidenteId);
        if (!incidente) {
            const error = new Error(`No existe el incidente ${incidenteId}`);
            error.estadoHttp = 404;
            throw error;
        }
        return incidente;
    }

    actualizarTelemetria(telemetria) {
        const indiceNodo = this.#estado.nodos.findIndex(({ id }) => id === telemetria.nodoId);
        if (indiceNodo === -1) {
            const error = new Error(`No existe el nodo ${telemetria.nodoId}`);
            error.estadoHttp = 404;
            throw error;
        }

        const nodoActual = this.#estado.nodos[indiceNodo];
        const indiceHorno = this.#estado.hornos.findIndex(({ id }) => id === nodoActual.hornoId);
        const hornoActual = this.#estado.hornos[indiceHorno];
        const estadoNodo = telemetria.rssi <= -75 ? "degradado" : "estable";
        const emergencia = telemetria.emergencia ?? hornoActual.emergencia;
        const fueraDeRango = telemetria.temperatura >= hornoActual.umbrales.temperaturaCritica
            || telemetria.ky026 >= hornoActual.umbrales.ky026Alto;

        this.#estado.nodos[indiceNodo] = {
            ...nodoActual,
            estado: estadoNodo,
            rssi: telemetria.rssi,
            latencia: telemetria.latencia,
            perdidas: telemetria.perdidas,
            retransmisiones: telemetria.retransmisiones,
            ultimoDato: telemetria.timestamp
        };
        this.#estado.hornos[indiceHorno] = {
            ...hornoActual,
            temperatura: telemetria.temperatura,
            ky026: telemetria.ky026,
            emergencia,
            estado: emergencia || fueraDeRango ? "critico" : estadoNodo === "degradado" ? "advertencia" : "normal"
        };

        this.#sincronizarIncidente({
            prioridad: "P0", hornoId: hornoActual.id, activo: emergencia,
            tipo: "emergencia", titulo: "Emergencia activa", estadoActivo: "sin-atender"
        });
        this.#sincronizarIncidente({
            prioridad: "P1", hornoId: hornoActual.id, activo: fueraDeRango,
            tipo: "alerta",
            titulo: telemetria.temperatura >= hornoActual.umbrales.temperaturaCritica
                ? "Temperatura sobre el límite"
                : "KY-026 sobre el umbral",
            estadoActivo: "activo"
        });

        this.#simulacionActiva = false;
        this.#estado.sistema.modo = "Datos externos";
        this.#estado.sistema.actualizadoEn = new Date().toISOString();
        return this.#publicarActualizacion();
    }

    #sincronizarIncidente({ prioridad, hornoId, activo, tipo, titulo, estadoActivo }) {
        const existente = this.#estado.incidentes.find((incidente) =>
            incidente.prioridad === prioridad && incidente.hornoId === hornoId && incidente.estado !== "resuelto"
        );

        if (activo && !existente) {
            this.#estado.incidentes.push({
                id: `incidente-${Date.now()}-${prioridad.toLowerCase()}`,
                prioridad, tipo, hornoId, titulo, estado: estadoActivo, inicio: new Date().toISOString()
            });
        } else if (activo && existente) {
            existente.titulo = titulo;
        } else if (!activo && existente) {
            existente.estado = "resuelto";
            existente.finalizacion = new Date().toISOString();
        }
    }

    #publicarActualizacion() {
        const estado = this.obtenerEstado();
        this.emit("actualizacion", estado);
        return estado;
    }

    simularSiguienteLectura(ahora = new Date()) {
        if (!this.#simulacionActiva) return null;
        const segundos = ahora.getTime() / 1000;

        this.#estado.hornos = this.#estado.hornos.map((horno, indice) => ({
            ...horno,
            temperatura: redondear(horno.temperatura + Math.sin(segundos / 18 + indice) * 0.08),
            ky026: Math.round(limitar(horno.ky026 + Math.sin(segundos / 12 + indice) * 0.4, 0, 100))
        }));

        this.#estado.nodos = this.#estado.nodos.map((nodo, indice) => ({
            ...nodo,
            rssi: Math.round(nodo.rssi + Math.sin(segundos / 10 + indice) * 0.3),
            latencia: Math.max(1, Math.round(nodo.latencia + Math.sin(segundos / 8 + indice))),
            ultimoDato: ahora.toISOString()
        }));

        this.#estado.sistema.actualizadoEn = ahora.toISOString();
        return this.#publicarActualizacion();
    }
}

export const estadoSistema = new EstadoSistema();
