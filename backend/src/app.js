import express from "express";
import { configuracion } from "./configuracion.js";
import { estadoSistema } from "./servicios/estadoSistema.js";
import { validarTelemetria } from "./validadores/telemetria.js";
import { validarModo } from "./validadores/modo.js";
import { validarOperador } from "./validadores/incidente.js";
import { validarMensaje } from "./validadores/mensaje.js";
import { colaPrioridad } from "./servicios/colaPrioridad.js";

export const crearApp = () => {
    const app = express();
    app.use(express.json({ limit: "100kb" }));
    app.use((solicitud, respuesta, siguiente) => {
        respuesta.setHeader("Access-Control-Allow-Origin", configuracion.origenPermitido);
        respuesta.setHeader("Access-Control-Allow-Headers", "Content-Type");
        respuesta.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
        if (solicitud.method === "OPTIONS") return respuesta.sendStatus(204);
        siguiente();
    });

    app.get("/api/salud", (_solicitud, respuesta) => respuesta.json({ estado: "ok", servicio: "scp-backend", fecha: new Date().toISOString() }));
    app.get("/api/estado", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerEstado()));
    app.get("/api/hornos", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerHornos()));
    app.get("/api/nodos", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerNodos()));
    app.get("/api/incidentes", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerIncidentes()));
    app.get("/api/modo", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerModo()));
    app.get("/api/cola", (_solicitud, respuesta) => respuesta.json(colaPrioridad.obtenerEstado()));
    app.post("/api/mensajes", (solicitud, respuesta, siguiente) => {
        try {
            const mensaje = validarMensaje(solicitud.body);
            if (!estadoSistema.existeNodo(mensaje.nodoId)) {
                const error = new Error(`No existe el nodo ${mensaje.nodoId}`);
                error.estadoHttp = 404;
                throw error;
            }
            const resultado = colaPrioridad.encolar(mensaje);
            respuesta.status(resultado.aceptado ? 202 : 503).json({
                mensaje: resultado.aceptado ? "Mensaje agregado a la cola" : "Mensaje descartado porque la cola está llena",
                resultado,
                cola: colaPrioridad.obtenerEstado()
            });
        } catch (error) {
            siguiente(error);
        }
    });
    app.patch("/api/modo", (solicitud, respuesta, siguiente) => {
        try {
            const modo = validarModo(solicitud.body);
            const estado = estadoSistema.cambiarModo(modo);
            respuesta.json({ mensaje: `Modo cambiado a ${estado.sistema.modo}`, estado });
        } catch (error) {
            siguiente(error);
        }
    });
    app.patch("/api/incidentes/:incidenteId/reconocer", (solicitud, respuesta, siguiente) => {
        try {
            const operador = validarOperador(solicitud.body);
            const estado = estadoSistema.reconocerIncidente(solicitud.params.incidenteId, operador);
            respuesta.json({ mensaje: "Incidente reconocido", estado });
        } catch (error) {
            siguiente(error);
        }
    });
    app.patch("/api/incidentes/:incidenteId/cerrar", (solicitud, respuesta, siguiente) => {
        try {
            const operador = validarOperador(solicitud.body);
            const estado = estadoSistema.cerrarIncidente(solicitud.params.incidenteId, operador);
            respuesta.json({ mensaje: "Incidente cerrado", estado });
        } catch (error) {
            siguiente(error);
        }
    });
    app.post("/api/telemetria", (solicitud, respuesta, siguiente) => {
        try {
            const telemetria = validarTelemetria(solicitud.body);
            const estado = estadoSistema.actualizarTelemetria(telemetria);
            respuesta.json({ mensaje: "Telemetría recibida", estado });
        } catch (error) {
            siguiente(error);
        }
    });
    app.use((_solicitud, respuesta) => respuesta.status(404).json({ error: "Recurso no encontrado" }));
    app.use((error, _solicitud, respuesta, _siguiente) => {
        respuesta.status(error.estadoHttp ?? 500).json({
            error: error.message ?? "Error interno del servidor",
            ...(error.detalles ? { detalles: error.detalles } : {})
        });
    });
    return app;
};
