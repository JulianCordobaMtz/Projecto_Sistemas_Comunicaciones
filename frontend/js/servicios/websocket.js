import { establecerEstadoBackend } from "./datosSimulados.js";

const URL_BACKEND = "ws://localhost:3000/ws";
const RETARDO_RECONEXION = 3000;

export const conectarBackend = ({ alActualizar, alCambiarEstado } = {}) => {
    let cliente = null;
    let temporizadorReconexion = null;
    let detenido = false;

    const notificarEstado = (conexion, modo) => {
        alCambiarEstado?.({ conexion, modo });
    };

    const conectar = () => {
        if (detenido) return;
        notificarEstado("Conectando…");
        cliente = new WebSocket(URL_BACKEND);

        cliente.addEventListener("open", () => notificarEstado("En línea"));
        cliente.addEventListener("message", (evento) => {
            try {
                const mensaje = JSON.parse(evento.data);
                if (!["estado_inicial", "actualizacion_sistema"].includes(mensaje.tipo)) return;
                establecerEstadoBackend(mensaje.datos);
                notificarEstado("En línea", mensaje.datos.sistema?.modo);
                alActualizar?.(mensaje.datos);
            } catch (error) {
                console.error("No fue posible procesar el mensaje del backend", error);
            }
        });
        cliente.addEventListener("close", () => {
            notificarEstado("Sin conexión");
            if (!detenido) temporizadorReconexion = window.setTimeout(conectar, RETARDO_RECONEXION);
        });
        cliente.addEventListener("error", () => cliente.close());
    };

    conectar();

    return () => {
        detenido = true;
        window.clearTimeout(temporizadorReconexion);
        cliente?.close();
    };
};
