import assert from "node:assert/strict";
import { describe, test } from "node:test";

let numeroCaso = 0;

async function crearCola(t) {
    const url = new URL("../src/servicios/colaPrioridad.js", import.meta.url);
    url.searchParams.set("caso", String(++numeroCaso));
    const { colaPrioridad: cola } = await import(url.href);

    t.after(() => {
        cola.detener();
        cola.removeAllListeners();
        t.mock.timers.reset();
    });

    return cola;
}

function datosMensaje(prioridad, contenido) {
    return { nodoId: "nodo-prueba", prioridad, tipo: "prueba", contenido };
}

function encolar(cola, prioridad, contenido) {
    const resultado = cola.encolar(datosMensaje(prioridad, contenido));
    assert.equal(resultado.aceptado, true);
    assert.equal(resultado.mensaje.estado, "pendiente");
    return resultado.mensaje;
}

function llenarCola(cola, prioridad, cantidad = 100) {
    return Array.from({ length: cantidad }, (_, indice) =>
        encolar(cola, prioridad, `Mensaje ${indice}`)
    );
}

function procesarMensajes(cola, cantidad) {
    return Array.from({ length: cantidad }, () => {
        const mensaje = cola.procesarSiguiente();
        assert.notEqual(mensaje, null);
        assert.equal(mensaje.estado, "procesado");
        return mensaje;
    });
}

function contadores(cola) {
    return cola.obtenerEstado().prioridades.map(({
        prioridad, pendientes, procesados, descartados
    }) => ({ prioridad, pendientes, procesados, descartados }));
}

describe("Cola prioritaria", { concurrency: false }, () => {
    test("cola vacía: procesar devuelve null sin cambiar el estado", async (t) => {
        const cola = await crearCola(t);
        const inicial = cola.obtenerEstado();

        assert.equal(inicial.capacidad, 100);
        assert.equal(inicial.totalPendientes, 0);
        assert.deepEqual(inicial.ultimosProcesados, []);
        assert.deepEqual(contadores(cola), [
            { prioridad: "P0", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P1", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P2", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P3", pendientes: 0, procesados: 0, descartados: 0 }
        ]);
        for (const nivel of inicial.prioridades) {
            assert.equal(nivel.latenciaPromedio, 0);
        }

        assert.equal(cola.procesarSiguiente(), null);
        assert.deepEqual(cola.obtenerEstado(), inicial);
    });

    test("procesa P0 → P1 → P2 → P3 con todos los mensajes pendientes", async (t) => {
        const cola = await crearCola(t);
        const mensajes = ["P3", "P1", "P2", "P0"].map((prioridad) =>
            encolar(cola, prioridad, `Mensaje ${prioridad}`)
        );

        assert.equal(cola.obtenerEstado().totalPendientes, 4);
        assert.ok(cola.obtenerEstado().prioridades.every((nivel) => nivel.procesados === 0));

        const procesados = procesarMensajes(cola, 4);
        assert.deepEqual(procesados.map(({ prioridad }) => prioridad), ["P0", "P1", "P2", "P3"]);
        assert.deepEqual(procesados.map(({ id }) => id),
            [mensajes[3].id, mensajes[1].id, mensajes[2].id, mensajes[0].id]);
        assert.equal(cola.obtenerEstado().totalPendientes, 0);
        assert.equal(cola.procesarSiguiente(), null);
    });

    test("conserva FIFO entre mensajes de la misma prioridad", async (t) => {
        const cola = await crearCola(t);
        const mensajes = ["Primero", "Segundo", "Tercero"].map((contenido) =>
            encolar(cola, "P2", contenido)
        );

        const procesados = procesarMensajes(cola, 3);
        assert.deepEqual(procesados.map(({ id }) => id), mensajes.map(({ id }) => id));
        assert.deepEqual(procesados.map(({ contenido }) => contenido), ["Primero", "Segundo", "Tercero"]);
        assert.equal(cola.procesarSiguiente(), null);
    });

    test("admite 100 pendientes y reutiliza el espacio liberado al procesar", async (t) => {
        const cola = await crearCola(t);
        const mensajes = llenarCola(cola, "P2");

        assert.equal(cola.obtenerEstado().capacidad, 100);
        assert.equal(cola.obtenerEstado().totalPendientes, 100);
        assert.equal(cola.procesarSiguiente().id, mensajes[0].id);
        assert.equal(cola.obtenerEstado().totalPendientes, 99);

        const nuevo = encolar(cola, "P2", "Mensaje tras liberar espacio");
        assert.equal(cola.obtenerEstado().totalPendientes, 100);
        assert.deepEqual(procesarMensajes(cola, 100).map(({ id }) => id),
            [...mensajes.slice(1).map(({ id }) => id), nuevo.id]);
        assert.equal(cola.obtenerEstado().totalPendientes, 0);
        assert.ok(cola.obtenerEstado().prioridades.every((nivel) => nivel.descartados === 0));
        assert.equal(cola.procesarSiguiente(), null);
    });

    test("admite P1 desplazando un P3 sin fijar cuál de sus mensajes se descarta", async (t) => {
        const cola = await crearCola(t);
        const mensajesP3 = [encolar(cola, "P3", "P3 A"), encolar(cola, "P3", "P3 B")];
        const mensajesP2 = llenarCola(cola, "P2", 98);
        assert.equal(cola.obtenerEstado().totalPendientes, 100);

        const mensajeP1 = encolar(cola, "P1", "P1 entrante");
        assert.equal(cola.obtenerEstado().totalPendientes, 100);
        assert.deepEqual(contadores(cola), [
            { prioridad: "P0", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P1", pendientes: 1, procesados: 0, descartados: 0 },
            { prioridad: "P2", pendientes: 98, procesados: 0, descartados: 0 },
            { prioridad: "P3", pendientes: 1, procesados: 0, descartados: 1 }
        ]);

        const procesados = procesarMensajes(cola, 100);
        assert.equal(procesados[0].id, mensajeP1.id);
        assert.deepEqual(procesados.slice(1, 99).map(({ id }) => id), mensajesP2.map(({ id }) => id));
        const supervivientesP3 = procesados.filter(({ prioridad }) => prioridad === "P3");
        assert.equal(supervivientesP3.length, 1);
        assert.ok(mensajesP3.some(({ id }) => id === supervivientesP3[0].id));
        assert.equal(mensajesP3.filter(({ id }) => !procesados.some((mensaje) => mensaje.id === id)).length, 1);
        assert.equal(cola.procesarSiguiente(), null);
    });

    test("rechaza si los pendientes tienen prioridad igual o mayor que la entrante", async (t) => {
        for (const prioridadEntrante of ["P0", "P1"]) {
            const cola = await crearCola(t);
            const mensajes = llenarCola(cola, "P0");
            const resultado = cola.encolar(datosMensaje(prioridadEntrante, "Mensaje rechazado"));

            assert.equal(resultado.aceptado, false);
            assert.equal(resultado.motivo, "cola-llena");
            assert.equal(resultado.mensaje.prioridad, prioridadEntrante);
            assert.equal(cola.obtenerEstado().totalPendientes, 100);
            for (const nivel of cola.obtenerEstado().prioridades) {
                assert.equal(nivel.pendientes, nivel.prioridad === "P0" ? 100 : 0);
                assert.equal(nivel.procesados, 0);
                assert.equal(nivel.descartados, nivel.prioridad === prioridadEntrante ? 1 : 0);
            }
            assert.deepEqual(procesarMensajes(cola, 100).map(({ id }) => id), mensajes.map(({ id }) => id));
            assert.equal(cola.procesarSiguiente(), null);
        }
    });

    test("contabiliza pendientes, procesados y descartados por prioridad", async (t) => {
        const cola = await crearCola(t);
        const mensajesP2 = llenarCola(cola, "P2", 99);
        const mensajeP3 = encolar(cola, "P3", "P3 desplazado");
        const mensajeP0 = encolar(cola, "P0", "P0 admitido");
        const rechazo = cola.encolar(datosMensaje("P3", "P3 rechazado"));

        assert.equal(rechazo.aceptado, false);
        assert.equal(rechazo.motivo, "cola-llena");
        assert.equal(cola.obtenerEstado().totalPendientes, 100);
        assert.deepEqual(contadores(cola), [
            { prioridad: "P0", pendientes: 1, procesados: 0, descartados: 0 },
            { prioridad: "P1", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P2", pendientes: 99, procesados: 0, descartados: 0 },
            { prioridad: "P3", pendientes: 0, procesados: 0, descartados: 2 }
        ]);

        const procesados = procesarMensajes(cola, 2);
        assert.deepEqual(procesados.map(({ id }) => id), [mensajeP0.id, mensajesP2[0].id]);
        const estado = cola.obtenerEstado();
        assert.equal(estado.totalPendientes, 98);
        assert.deepEqual(contadores(cola), [
            { prioridad: "P0", pendientes: 0, procesados: 1, descartados: 0 },
            { prioridad: "P1", pendientes: 0, procesados: 0, descartados: 0 },
            { prioridad: "P2", pendientes: 98, procesados: 1, descartados: 0 },
            { prioridad: "P3", pendientes: 0, procesados: 0, descartados: 2 }
        ]);
        assert.equal(estado.prioridades.reduce((total, nivel) => total + nivel.pendientes, 0), estado.totalPendientes);
        assert.equal(estado.prioridades.reduce((total, nivel) =>
            total + nivel.pendientes + nivel.procesados + nivel.descartados, 0), 102);
        assert.deepEqual(new Set(estado.ultimosProcesados.map(({ id }) => id)), new Set(procesados.map(({ id }) => id)));
        assert.ok(!estado.ultimosProcesados.some(({ id }) => id === mensajeP3.id || id === rechazo.mensaje.id));
    });

    test("calcula espera y promedio usando únicamente un reloj Date controlado", async (t) => {
        const cola = await crearCola(t);
        const inicio = Date.parse("2026-01-01T00:00:00.000Z");
        t.mock.timers.enable({ apis: ["Date"], now: inicio });

        const primero = encolar(cola, "P2", "Primero");
        t.mock.timers.tick(100);
        const segundo = encolar(cola, "P2", "Segundo");
        assert.equal(primero.recibidoEn, new Date(inicio).toISOString());
        assert.equal(segundo.recibidoEn, new Date(inicio + 100).toISOString());
        assert.equal(cola.obtenerEstado().prioridades.find(({ prioridad }) => prioridad === "P2").latenciaPromedio, 0);

        t.mock.timers.tick(100);
        const procesadoPrimero = cola.procesarSiguiente();
        assert.equal(procesadoPrimero.id, primero.id);
        assert.equal(procesadoPrimero.latencia, 200);
        assert.equal(procesadoPrimero.procesadoEn, new Date(inicio + 200).toISOString());
        assert.equal(cola.obtenerEstado().prioridades.find(({ prioridad }) => prioridad === "P2").latenciaPromedio, 200);

        t.mock.timers.tick(200);
        const procesadoSegundo = cola.procesarSiguiente();
        assert.equal(procesadoSegundo.id, segundo.id);
        assert.equal(procesadoSegundo.latencia, 300);
        assert.equal(procesadoSegundo.procesadoEn, new Date(inicio + 400).toISOString());
        const estado = cola.obtenerEstado();
        const nivelP2 = estado.prioridades.find(({ prioridad }) => prioridad === "P2");
        assert.equal(nivelP2.latenciaPromedio, 250);
        assert.equal(nivelP2.procesados, 2);
        assert.equal(nivelP2.descartados, 0);
        assert.equal(estado.totalPendientes, 0);
        for (const nivel of estado.prioridades.filter(({ prioridad }) => prioridad !== "P2")) {
            assert.equal(nivel.latenciaPromedio, 0);
        }
        assert.equal(cola.procesarSiguiente(), null);
    });
});
