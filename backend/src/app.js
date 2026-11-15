import express from "express";
import { configuracion } from "./configuracion.js";
import { estadoSistema } from "./servicios/estadoSistema.js";

export const crearApp = () => {
    const app = express();
    app.use(express.json({ limit: "100kb" }));
    app.use((solicitud, respuesta, siguiente) => {
        respuesta.setHeader("Access-Control-Allow-Origin", configuracion.origenPermitido);
        respuesta.setHeader("Access-Control-Allow-Headers", "Content-Type");
        respuesta.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
        if (solicitud.method === "OPTIONS") return respuesta.sendStatus(204);
        siguiente();
    });

    app.get("/api/salud", (_solicitud, respuesta) => respuesta.json({ estado: "ok", servicio: "scp-backend", fecha: new Date().toISOString() }));
    app.get("/api/estado", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerEstado()));
    app.get("/api/hornos", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerHornos()));
    app.get("/api/nodos", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerNodos()));
    app.get("/api/incidentes", (_solicitud, respuesta) => respuesta.json(estadoSistema.obtenerIncidentes()));
    app.use((_solicitud, respuesta) => respuesta.status(404).json({ error: "Recurso no encontrado" }));
    return app;
};
