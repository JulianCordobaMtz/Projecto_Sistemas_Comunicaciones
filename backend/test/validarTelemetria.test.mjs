import assert from "node:assert/strict";
import test from "node:test";

import { validarTelemetria } from "../src/validadores/telemetria.js";

const crearDatos = (cambios = {}) => ({
    nodoId: "nodo-01",
    temperatura: 30,
    ky026: 20,
    rssi: -60,
    latencia: 25,
    perdidas: 0,
    retransmisiones: 0,
    emergenciaMedica: false,
    atencionMedicaPresente: false,
    estadoHorno: "en-operacion",
    ...cambios
});

test("acepta los controles físicos definidos para el nodo", () => {
    const telemetria = validarTelemetria(crearDatos({
        emergenciaMedica: true,
        atencionMedicaPresente: true,
        estadoHorno: "fuera-de-operacion"
    }));

    assert.equal(telemetria.emergenciaMedica, true);
    assert.equal(telemetria.atencionMedicaPresente, true);
    assert.equal(telemetria.estadoHorno, "fuera-de-operacion");
});

test("mantiene compatibilidad temporal con el campo emergencia", () => {
    const datos = crearDatos();
    delete datos.emergenciaMedica;
    datos.emergencia = true;
    assert.equal(validarTelemetria(datos).emergenciaMedica, true);
});

test("rechaza un estado de horno desconocido", () => {
    assert.throws(
        () => validarTelemetria(crearDatos({ estadoHorno: "apagado" })),
        (error) => error.estadoHttp === 400
            && error.detalles.includes("estadoHorno debe ser en-operacion o fuera-de-operacion")
    );
});
