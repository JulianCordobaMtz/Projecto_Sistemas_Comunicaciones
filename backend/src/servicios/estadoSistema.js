import { EventEmitter } from "node:events";
import { crearEstadoInicial } from "../datos/estadoInicial.js";

const redondear = (valor, decimales = 1) => Number(valor.toFixed(decimales));
const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

export class EstadoSistema extends EventEmitter {
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

        if (!incidente.reconocidoEn) {
            incidente.estado = incidente.estado === "normalizado-sin-reconocer"
                ? "pendiente-verificacion"
                : incidente.estado === "atencion-presente-sin-reconocer"
                    ? "atencion-presente"
                    : "reconocido";
            incidente.reconocidoEn = new Date().toISOString();
            incidente.operadorReconocimiento = operador;
        }

        return this.#publicarActualizacion();
    }

    cerrarIncidente(incidenteId, operador) {
        return this.verificarNormalizacion(incidenteId, operador);
    }

    verificarNormalizacion(incidenteId, operador) {
        const incidente = this.#obtenerIncidenteEditable(incidenteId);
        const esEmergenciaMedicaAtendida = incidente.tipo === "emergencia-medica"
            && incidente.estado === "atencion-presente";
        if (incidente.estado !== "pendiente-verificacion" && !esEmergenciaMedicaAtendida) {
            const error = new Error(incidente.tipo === "emergencia-medica"
                ? "La llegada del personal médico debe estar confirmada antes de cerrar la atención"
                : "El incidente debe estar reconocido y con la condición normalizada antes de verificarlo");
            error.estadoHttp = 409;
            throw error;
        }

        const finalizacion = new Date();
        incidente.estado = "resuelto";
        incidente.resultado = esEmergenciaMedicaAtendida
            ? "atencion-medica-concluida"
            : "normalizado-verificado";
        incidente.finalizacion = finalizacion.toISOString();
        incidente.operadorVerificacion = operador;
        incidente.duracionSegundos = Math.max(0, Math.floor((finalizacion - new Date(incidente.inicio)) / 1000));

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
        const fechaTelemetria = new Date(telemetria.timestamp);
        const fechaEvento = Number.isNaN(fechaTelemetria.getTime()) ? new Date() : fechaTelemetria;
        const estadoNodo = telemetria.rssi <= -75 ? "degradado" : "estable";
        const emergenciaMedica = telemetria.emergenciaMedica ?? hornoActual.emergenciaMedica;
        const atencionMedicaPresente = telemetria.atencionMedicaPresente ?? hornoActual.atencionMedicaPresente;
        const nuevaEmergenciaMedica = emergenciaMedica && !hornoActual.emergenciaMedica;
        const nuevaLlegadaAtencion = atencionMedicaPresente && !hornoActual.atencionMedicaPresente;
        const estadoHorno = telemetria.estadoHorno ?? hornoActual.estadoHorno ?? "en-operacion";
        const hornoEnOperacion = estadoHorno === "en-operacion";
        const temperaturaCritica = telemetria.temperatura >= hornoActual.umbrales.temperaturaCritica;
        const flamaAlta = telemetria.ky026 >= hornoActual.umbrales.ky026Alto;
        const riesgoExtremo = hornoEnOperacion
            && telemetria.temperatura >= hornoActual.umbrales.temperaturaExtrema
            && telemetria.ky026 >= hornoActual.umbrales.ky026Extremo;
        const flamaConHornoApagado = !hornoEnOperacion && flamaAlta;
        const riesgoIncendio = riesgoExtremo || flamaConHornoApagado;
        const fueraDeRango = hornoEnOperacion && (temperaturaCritica || flamaAlta) && !riesgoIncendio;

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
            emergencia: emergenciaMedica,
            emergenciaMedica,
            atencionMedicaPresente,
            estadoHorno,
            estado: emergenciaMedica || riesgoIncendio || fueraDeRango
                ? "critico"
                : !hornoEnOperacion
                    ? "fuera-de-operacion"
                    : estadoNodo === "degradado" ? "advertencia" : "normal"
        };

        this.#sincronizarIncidente({
            prioridad: "P0", hornoId: hornoActual.id, activo: emergenciaMedica,
            tipo: "emergencia-medica", titulo: "Emergencia médica", estadoActivo: "sin-atender",
            fechaEvento, mantenerHastaConfirmacion: true, permitirCreacion: nuevaEmergenciaMedica
        });
        this.#registrarLlegadaAtencionMedica(hornoActual.id, nuevaLlegadaAtencion, fechaEvento);
        this.#sincronizarIncidente({
            prioridad: "P0", hornoId: hornoActual.id, activo: riesgoIncendio,
            tipo: "incendio", titulo: flamaConHornoApagado
                ? "Flama detectada con el horno fuera de operación"
                : "Incendio o riesgo de explosión",
            estadoActivo: "sin-atender", fechaEvento
        });
        this.#sincronizarIncidente({
            prioridad: "P1", hornoId: hornoActual.id, activo: fueraDeRango,
            tipo: "alerta-operativa",
            titulo: temperaturaCritica
                ? "Temperatura sobre el límite"
                : "KY-026 sobre el umbral",
            estadoActivo: "activo",
            fechaEvento
        });

        this.#simulacionActiva = false;
        this.#estado.sistema.modo = "Datos externos";
        this.#estado.sistema.actualizadoEn = new Date().toISOString();
        return this.#publicarActualizacion();
    }

    supervisarComunicaciones(ahora = new Date(), umbralSegundos = 15) {
        let huboCambios = false;

        this.#estado.nodos.forEach((nodo, indice) => {
            const ultimoDato = new Date(nodo.ultimoDato);
            const edadSegundos = Number.isNaN(ultimoDato.getTime())
                ? Number.POSITIVE_INFINITY
                : Math.max(0, (ahora - ultimoDato) / 1000);
            const sinComunicacion = edadSegundos >= umbralSegundos;
            const horno = this.#estado.hornos.find(({ id }) => id === nodo.hornoId);
            const tipo = "sin-comunicacion";
            const existente = this.#estado.incidentes.find((incidente) =>
                incidente.tipo === tipo && incidente.hornoId === nodo.hornoId && incidente.estado !== "resuelto"
            );
            const prioridad = horno?.estadoHorno === "fuera-de-operacion" ? "P1" : "P0";

            if (sinComunicacion && (!existente || existente.prioridad !== prioridad)) huboCambios = true;
            if (!sinComunicacion && existente
                && !["normalizado-sin-reconocer", "pendiente-verificacion"].includes(existente.estado)) {
                huboCambios = true;
            }

            this.#estado.nodos[indice] = {
                ...nodo,
                estado: sinComunicacion ? "sin-comunicacion" : nodo.estado
            };
            this.#sincronizarIncidente({
                prioridad,
                hornoId: nodo.hornoId,
                activo: sinComunicacion,
                tipo,
                titulo: `Sin comunicación con ${nodo.nombre}`,
                estadoActivo: "sin-atender",
                fechaEvento: sinComunicacion ? new Date(ultimoDato.getTime() + umbralSegundos * 1000) : ahora
            });
        });

        if (!huboCambios) return null;
        this.#estado.sistema.actualizadoEn = ahora.toISOString();
        return this.#publicarActualizacion();
    }

    #registrarLlegadaAtencionMedica(hornoId, presente, fechaEvento) {
        if (!presente) return;
        const incidente = this.#estado.incidentes.find(({ hornoId: origen, tipo, estado }) =>
            origen === hornoId && tipo === "emergencia-medica" && estado !== "resuelto"
        );
        if (!incidente || incidente.llegadaAtencionEn) return;

        incidente.llegadaAtencionEn = fechaEvento.toISOString();
        incidente.estado = incidente.reconocidoEn
            ? "atencion-presente"
            : "atencion-presente-sin-reconocer";
    }

    #sincronizarIncidente({ prioridad, hornoId, activo, tipo, titulo, estadoActivo, fechaEvento = new Date(), mantenerHastaConfirmacion = false, permitirCreacion = true }) {
        const existente = this.#estado.incidentes.find((incidente) =>
            incidente.tipo === tipo && incidente.hornoId === hornoId && incidente.estado !== "resuelto"
        );

        if (activo && !existente && permitirCreacion) {
            this.#estado.incidentes.push({
                id: `incidente-${Date.now()}-${hornoId}-${tipo}`,
                prioridad, tipo, hornoId, titulo, estado: estadoActivo, inicio: fechaEvento.toISOString()
            });
        } else if (activo && existente) {
            existente.prioridad = prioridad;
            existente.titulo = titulo;
            if (["normalizado-sin-reconocer", "pendiente-verificacion"].includes(existente.estado)) {
                if (existente.reconocidoEn) {
                    existente.historialReconocimientos = [
                        ...(existente.historialReconocimientos ?? []),
                        {
                            operador: existente.operadorReconocimiento,
                            fecha: existente.reconocidoEn
                        }
                    ];
                    delete existente.reconocidoEn;
                    delete existente.operadorReconocimiento;
                }
                existente.estado = estadoActivo;
                existente.reescaladoEn = fechaEvento.toISOString();
                delete existente.normalizadoEn;
            }
        } else if (!activo && existente && !mantenerHastaConfirmacion) {
            if (!["normalizado-sin-reconocer", "pendiente-verificacion"].includes(existente.estado)) {
                existente.estado = existente.reconocidoEn
                    ? "pendiente-verificacion"
                    : "normalizado-sin-reconocer";
                existente.normalizadoEn = fechaEvento.toISOString();
            }
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
