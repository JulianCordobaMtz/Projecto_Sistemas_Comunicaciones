import { createServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { crearApp } from "./app.js";
import { configuracion } from "./configuracion.js";
import { estadoSistema } from "./servicios/estadoSistema.js";
import { colaPrioridad } from "./servicios/colaPrioridad.js";

const servidor = createServer(crearApp());
const websocket = new WebSocketServer({ server: servidor, path: "/ws" });

const enviar = (cliente, tipo, datos) => {
    if (cliente.readyState === WebSocket.OPEN) {
        cliente.send(JSON.stringify({ tipo, datos, enviadoEn: new Date().toISOString() }));
    }
};

websocket.on("connection", (cliente) => enviar(cliente, "estado_inicial", estadoSistema.obtenerEstado()));

estadoSistema.on("actualizacion", (estado) => {
    websocket.clients.forEach((cliente) => enviar(cliente, "actualizacion_sistema", estado));
});

colaPrioridad.on("actualizacion", (resumen) => estadoSistema.actualizarCola(resumen));
colaPrioridad.iniciar(configuracion.intervaloProcesamiento);

const temporizador = setInterval(() => {
    estadoSistema.simularSiguienteLectura();
}, configuracion.intervaloSimulacion);

servidor.listen(configuracion.puerto, () => {
    console.log(`SCP backend disponible en http://localhost:${configuracion.puerto}`);
    console.log(`WebSocket disponible en ws://localhost:${configuracion.puerto}/ws`);
});

const cerrar = (senal) => {
    console.log(`Cerrando servidor por ${senal}...`);
    clearInterval(temporizador);
    colaPrioridad.detener();
    websocket.close(() => servidor.close(() => process.exit(0)));
};

process.on("SIGINT", () => cerrar("SIGINT"));
process.on("SIGTERM", () => cerrar("SIGTERM"));
