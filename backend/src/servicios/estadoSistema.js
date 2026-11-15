import { crearEstadoInicial } from "../datos/estadoInicial.js";

const redondear = (valor, decimales = 1) => Number(valor.toFixed(decimales));
const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

class EstadoSistema {
    #estado = crearEstadoInicial();

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

    simularSiguienteLectura(ahora = new Date()) {
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
        return this.obtenerEstado();
    }
}

export const estadoSistema = new EstadoSistema();
