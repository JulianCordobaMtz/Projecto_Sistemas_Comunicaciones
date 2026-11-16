import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

const PRIORIDADES = ["P0", "P1", "P2", "P3"];
const NOMBRES = Object.freeze({
    P0: "Emergencia",
    P1: "Alerta crítica",
    P2: "Advertencia",
    P3: "Informativo"
});

class ColaPrioridad extends EventEmitter {
    #colas = new Map(PRIORIDADES.map((prioridad) => [prioridad, []]));
    #metricas = new Map(PRIORIDADES.map((prioridad) => [prioridad, {
        procesados: 0,
        descartados: 0,
        esperaAcumulada: 0
    }]));
    #procesadosRecientes = [];
    #temporizador = null;
    #capacidad;

    constructor({ capacidad = 100 } = {}) {
        super();
        this.#capacidad = capacidad;
    }

    encolar(datos) {
        const mensaje = {
            id: randomUUID(),
            ...datos,
            estado: "pendiente",
            recibidoEn: new Date().toISOString()
        };

        if (this.#totalPendientes() >= this.#capacidad && !this.#liberarEspacioPara(mensaje.prioridad)) {
            this.#metricas.get(mensaje.prioridad).descartados += 1;
            this.#emitirActualizacion();
            return { aceptado: false, motivo: "cola-llena", mensaje };
        }

        this.#colas.get(mensaje.prioridad).push(mensaje);
        this.#emitirActualizacion();
        return { aceptado: true, mensaje };
    }

    procesarSiguiente() {
        const prioridad = PRIORIDADES.find((nivel) => this.#colas.get(nivel).length > 0);
        if (!prioridad) return null;

        const mensaje = this.#colas.get(prioridad).shift();
        const procesadoEn = new Date();
        const espera = Math.max(0, procesadoEn - new Date(mensaje.recibidoEn));
        const metrica = this.#metricas.get(prioridad);
        metrica.procesados += 1;
        metrica.esperaAcumulada += espera;

        const procesado = {
            ...mensaje,
            estado: "procesado",
            procesadoEn: procesadoEn.toISOString(),
            latencia: espera
        };
        this.#procesadosRecientes.unshift(procesado);
        this.#procesadosRecientes = this.#procesadosRecientes.slice(0, 20);
        this.emit("mensajeProcesado", structuredClone(procesado));
        this.#emitirActualizacion();
        return structuredClone(procesado);
    }

    iniciar(intervaloMs) {
        if (this.#temporizador) return;
        this.#temporizador = setInterval(() => this.procesarSiguiente(), intervaloMs);
    }

    detener() {
        clearInterval(this.#temporizador);
        this.#temporizador = null;
    }

    obtenerEstado() {
        return {
            capacidad: this.#capacidad,
            totalPendientes: this.#totalPendientes(),
            prioridades: PRIORIDADES.map((prioridad) => {
                const metrica = this.#metricas.get(prioridad);
                return {
                    prioridad,
                    nombre: NOMBRES[prioridad],
                    pendientes: this.#colas.get(prioridad).length,
                    latenciaPromedio: metrica.procesados === 0
                        ? 0
                        : Math.round(metrica.esperaAcumulada / metrica.procesados),
                    procesados: metrica.procesados,
                    descartados: metrica.descartados
                };
            }),
            ultimosProcesados: structuredClone(this.#procesadosRecientes)
        };
    }

    #totalPendientes() {
        return PRIORIDADES.reduce((total, prioridad) => total + this.#colas.get(prioridad).length, 0);
    }

    #liberarEspacioPara(prioridadEntrante) {
        const indiceEntrante = PRIORIDADES.indexOf(prioridadEntrante);
        for (let indice = PRIORIDADES.length - 1; indice > indiceEntrante; indice -= 1) {
            const prioridad = PRIORIDADES[indice];
            const cola = this.#colas.get(prioridad);
            if (cola.length > 0) {
                cola.pop();
                this.#metricas.get(prioridad).descartados += 1;
                return true;
            }
        }
        return false;
    }

    #emitirActualizacion() {
        this.emit("actualizacion", this.obtenerEstado());
    }
}

export const colaPrioridad = new ColaPrioridad();
