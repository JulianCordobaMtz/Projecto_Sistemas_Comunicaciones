const REGLAS_NUMERICAS = Object.freeze({
    temperatura: { minimo: -50, maximo: 500 },
    ky026: { minimo: 0, maximo: 100 },
    rssi: { minimo: -120, maximo: 0 },
    latencia: { minimo: 0, maximo: 60000 },
    perdidas: { minimo: 0, maximo: 100 },
    retransmisiones: { minimo: 0, maximo: 100000 }
});

export const validarTelemetria = (datos) => {
    const errores = [];
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
        const error = new TypeError("El cuerpo debe ser un objeto JSON");
        error.estadoHttp = 400;
        throw error;
    }

    if (typeof datos.nodoId !== "string" || datos.nodoId.trim() === "") {
        errores.push("nodoId es obligatorio");
    }

    Object.entries(REGLAS_NUMERICAS).forEach(([campo, regla]) => {
        const valor = datos[campo];
        if (!Number.isFinite(valor)) {
            errores.push(`${campo} debe ser un número`);
        } else if (valor < regla.minimo || valor > regla.maximo) {
            errores.push(`${campo} debe estar entre ${regla.minimo} y ${regla.maximo}`);
        }
    });

    if (Number.isFinite(datos.retransmisiones) && !Number.isInteger(datos.retransmisiones)) {
        errores.push("retransmisiones debe ser un número entero");
    }
    if (datos.emergencia !== undefined && typeof datos.emergencia !== "boolean") {
        errores.push("emergencia debe ser true o false");
    }
    if (datos.timestamp !== undefined && Number.isNaN(Date.parse(datos.timestamp))) {
        errores.push("timestamp debe tener formato de fecha ISO válido");
    }

    if (errores.length > 0) {
        const error = new TypeError("La telemetría contiene datos inválidos");
        error.estadoHttp = 400;
        error.detalles = errores;
        throw error;
    }

    return {
        nodoId: datos.nodoId.trim(),
        temperatura: datos.temperatura,
        ky026: datos.ky026,
        rssi: datos.rssi,
        latencia: datos.latencia,
        perdidas: datos.perdidas,
        retransmisiones: datos.retransmisiones,
        emergencia: datos.emergencia,
        timestamp: datos.timestamp ? new Date(datos.timestamp).toISOString() : new Date().toISOString()
    };
};
