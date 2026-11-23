import assert from "node:assert/strict";
import test from "node:test";

import { EstadoSistema } from "../src/servicios/estadoSistema.js";

const crearTelemetria = (cambios = {}) => ({
    nodoId: "nodo-02",
    temperatura: 41.8,
    ky026: 86,
    emergenciaMedica: true,
    atencionMedicaPresente: false,
    estadoHorno: "en-operacion",
    rssi: -61,
    latencia: 31,
    perdidas: 0.8,
    retransmisiones: 1,
    timestamp: new Date().toISOString(),
    ...cambios
});

test("conserva el reconocimiento durante las lecturas simuladas", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.reconocerIncidente("incidente-001", "Operador de prueba");
    estadoSistema.simularSiguienteLectura(new Date());

    const incidente = estadoSistema
        .obtenerIncidentes()
        .find(({ id }) => id === "incidente-001");

    assert.equal(incidente.estado, "reconocido");
    assert.equal(incidente.operadorReconocimiento, "Operador de prueba");
    assert.ok(incidente.reconocidoEn);
});

test("mantiene la emergencia médica abierta cuando se libera el pulsador", () => {
    const estadoSistema = new EstadoSistema();
    const instante = new Date(Date.now() + 60_000).toISOString();

    estadoSistema.reconocerIncidente("incidente-001", "Operador P0");
    estadoSistema.actualizarTelemetria(crearTelemetria({ emergenciaMedica: false, timestamp: instante }));

    const incidentes = estadoSistema.obtenerIncidentes();
    const emergencia = incidentes.find(({ id }) => id === "incidente-001");
    const alerta = incidentes.find(({ id }) => id === "incidente-002");

    assert.equal(emergencia.estado, "reconocido");
    assert.equal(emergencia.normalizadoEn, undefined);
    assert.equal(emergencia.finalizacion, undefined);
    assert.equal(emergencia.operadorReconocimiento, "Operador P0");
    assert.equal(emergencia.duracionSegundos, undefined);
    assert.notEqual(alerta.estado, "resuelto");
});

test("mantiene P1 sin reconocer hasta que un operador interviene", () => {
    const estadoSistema = new EstadoSistema();

    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 32,
        ky026: 20,
        emergenciaMedica: true,
        timestamp: new Date(Date.now() + 60_000).toISOString()
    }));

    const incidentes = estadoSistema.obtenerIncidentes();
    assert.notEqual(incidentes.find(({ id }) => id === "incidente-001").estado, "resuelto");
    assert.equal(incidentes.find(({ id }) => id === "incidente-002").estado, "normalizado-sin-reconocer");
});

test("no archiva automáticamente una normalización sin reconocimiento", () => {
    const estadoSistema = new EstadoSistema();

    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 30,
        ky026: 20,
        emergenciaMedica: false,
        timestamp: new Date(Date.now() + 60_000).toISOString()
    }));

    const incidentes = estadoSistema.obtenerIncidentes();
    const emergencia = incidentes.find(({ id }) => id === "incidente-001");
    const alerta = incidentes.find(({ id }) => id === "incidente-002");
    assert.equal(emergencia.estado, "sin-atender");
    assert.equal(alerta.estado, "normalizado-sin-reconocer");
    assert.ok(alerta.normalizadoEn);
});

test("exige reconocimiento y llegada médica antes de archivar una emergencia médica", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 30,
        ky026: 20,
        emergenciaMedica: false,
        timestamp: new Date(Date.now() + 60_000).toISOString()
    }));

    estadoSistema.reconocerIncidente("incidente-001", "Operador de atención");
    let incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === "incidente-001");
    assert.equal(incidente.estado, "reconocido");

    estadoSistema.actualizarTelemetria(crearTelemetria({
        emergenciaMedica: false,
        atencionMedicaPresente: true,
        timestamp: new Date(Date.now() + 120_000).toISOString()
    }));
    incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === "incidente-001");
    assert.equal(incidente.estado, "atencion-presente");
    assert.ok(incidente.llegadaAtencionEn);

    estadoSistema.verificarNormalizacion("incidente-001", "Supervisor de turno");
    incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === "incidente-001");
    assert.equal(incidente.estado, "resuelto");
    assert.equal(incidente.resultado, "atencion-medica-concluida");
    assert.equal(incidente.operadorReconocimiento, "Operador de atención");
    assert.equal(incidente.operadorVerificacion, "Supervisor de turno");
    assert.ok(incidente.finalizacion);
    assert.ok(incidente.duracionSegundos >= 0);
});

test("rechaza la verificación mientras la condición sigue activa", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.reconocerIncidente("incidente-001", "Operador de atención");

    assert.throws(
        () => estadoSistema.verificarNormalizacion("incidente-001", "Supervisor"),
        (error) => error.estadoHttp === 409
    );
});

test("mantiene el nodo comunicado cuando el horno queda fuera de operación", () => {
    const estadoSistema = new EstadoSistema();
    const instante = new Date(Date.now() + 60_000).toISOString();

    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 30,
        ky026: 0,
        emergenciaMedica: false,
        estadoHorno: "fuera-de-operacion",
        timestamp: instante
    }));

    const horno = estadoSistema.obtenerHornos().find(({ id }) => id === "horno-central");
    const nodo = estadoSistema.obtenerNodos().find(({ id }) => id === "nodo-02");
    assert.equal(horno.estadoHorno, "fuera-de-operacion");
    assert.equal(horno.estado, "fuera-de-operacion");
    assert.equal(nodo.estado, "estable");
    assert.equal(nodo.ultimoDato, instante);
});

test("genera P0 si detecta flama con el horno declarado fuera de operación", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 30,
        ky026: 80,
        emergenciaMedica: false,
        estadoHorno: "fuera-de-operacion"
    }));

    const incendio = estadoSistema.obtenerIncidentes().find(({ tipo, estado }) =>
        tipo === "incendio" && estado !== "resuelto"
    );
    assert.equal(incendio.prioridad, "P0");
    assert.equal(incendio.titulo, "Flama detectada con el horno fuera de operación");
});

test("registra la llegada médica sin cerrar automáticamente el incidente", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.actualizarTelemetria(crearTelemetria({ atencionMedicaPresente: true }));

    const incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === "incidente-001");
    assert.equal(incidente.estado, "atencion-presente-sin-reconocer");
    assert.ok(incidente.llegadaAtencionEn);
    assert.equal(incidente.finalizacion, undefined);
});

test("crea P0 por pérdida de comunicación con un horno en operación", () => {
    const estadoSistema = new EstadoSistema();
    const estadoInicial = estadoSistema.obtenerEstado();
    const ultimoDato = new Date(estadoInicial.nodos[0].ultimoDato);

    estadoSistema.supervisarComunicaciones(new Date(ultimoDato.getTime() + 16_000));

    const incidentesComunicacion = estadoSistema.obtenerIncidentes()
        .filter(({ tipo }) => tipo === "sin-comunicacion");
    assert.equal(incidentesComunicacion.length, 3);
    assert.equal(new Set(incidentesComunicacion.map(({ id }) => id)).size, 3);
    assert.ok(incidentesComunicacion.every(({ prioridad }) => prioridad === "P0"));
});

test("crea P1 por pérdida de comunicación si el horno está fuera de operación", () => {
    const estadoSistema = new EstadoSistema();
    const instante = new Date(Date.now() + 1_000);
    estadoSistema.actualizarTelemetria(crearTelemetria({
        temperatura: 30,
        ky026: 0,
        emergenciaMedica: false,
        estadoHorno: "fuera-de-operacion",
        timestamp: instante.toISOString()
    }));

    estadoSistema.supervisarComunicaciones(new Date(instante.getTime() + 16_000));

    const incidente = estadoSistema.obtenerIncidentes().find(({ tipo, hornoId }) =>
        tipo === "sin-comunicacion" && hornoId === "horno-central"
    );
    assert.equal(incidente.prioridad, "P1");
});

test("mantiene el incidente de comunicación hasta reconocer y verificar la recuperación", () => {
    const estadoSistema = new EstadoSistema();
    const estadoInicial = estadoSistema.obtenerEstado();
    const ultimoDato = new Date(estadoInicial.nodos[1].ultimoDato);
    const momentoFalla = new Date(ultimoDato.getTime() + 16_000);
    estadoSistema.supervisarComunicaciones(momentoFalla);

    let incidente = estadoSistema.obtenerIncidentes().find(({ tipo, hornoId }) =>
        tipo === "sin-comunicacion" && hornoId === "horno-central"
    );
    estadoSistema.reconocerIncidente(incidente.id, "Operador de red");
    estadoSistema.actualizarTelemetria(crearTelemetria({
        timestamp: new Date(momentoFalla.getTime() + 1_000).toISOString()
    }));
    estadoSistema.supervisarComunicaciones(new Date(momentoFalla.getTime() + 2_000));

    incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === incidente.id);
    assert.equal(incidente.estado, "pendiente-verificacion");
    assert.equal(incidente.finalizacion, undefined);
});

test("reescalona una alerta operativa si la condición empeora antes de verificar", () => {
    const estadoSistema = new EstadoSistema();
    estadoSistema.reconocerIncidente("incidente-002", "Operador inicial");
    estadoSistema.actualizarTelemetria(crearTelemetria({
        emergenciaMedica: true,
        temperatura: 30,
        ky026: 20,
        timestamp: new Date(Date.now() + 60_000).toISOString()
    }));
    estadoSistema.actualizarTelemetria(crearTelemetria({
        emergenciaMedica: true,
        temperatura: 42,
        ky026: 20,
        timestamp: new Date(Date.now() + 120_000).toISOString()
    }));

    const incidente = estadoSistema.obtenerIncidentes().find(({ id }) => id === "incidente-002");
    assert.equal(incidente.estado, "activo");
    assert.equal(incidente.reconocidoEn, undefined);
    assert.equal(incidente.operadorReconocimiento, undefined);
    assert.equal(incidente.historialReconocimientos[0].operador, "Operador inicial");
    assert.ok(incidente.reescaladoEn);
});
