const evento = (datos) => Object.freeze(datos);

export const eventosHistorial = Object.freeze([
    evento({
        id: "evt-001", fecha: "2026-11-12T14:34:51-06:00", prioridad: "P0",
        area: "Área 02", origen: "Área 02 · Horno central", evento: "Emergencia médica activada",
        duracion: "42 s", duracionSegundos: 42, resultado: "Cerrado", operador: "Operador 01",
        reconocimiento: "2026-11-12T14:35:18-06:00", finalizacion: "2026-11-12T14:35:33-06:00",
        secuencia: ["Emergencia detectada y mensaje P0 generado.", "Mensaje recibido por la estación central.", "Operador reconoce el incidente.", "Condición normalizada y evento cerrado."]
    }),
    evento({
        id: "evt-002", fecha: "2026-11-12T13:18:22-06:00", prioridad: "P1",
        area: "Área 02", origen: "Área 02 · Horno central", evento: "Temperatura sobre el límite",
        duracion: "2 min 16 s", duracionSegundos: 136, resultado: "Normalizado", operador: "Operador 02",
        reconocimiento: "2026-11-12T13:19:04-06:00", finalizacion: "2026-11-12T13:20:38-06:00",
        secuencia: ["Temperatura crítica detectada.", "Alerta P1 recibida por la estación.", "Operador reconoce la alerta.", "Temperatura dentro del rango permitido."]
    }),
    evento({
        id: "evt-003", fecha: "2026-11-12T11:46:05-06:00", prioridad: "Red",
        area: "Área 03", origen: "Nodo 03 · Horno sur", evento: "Enlace degradado",
        duracion: "4 min 08 s", duracionSegundos: 248, resultado: "Recuperado", operador: "Sistema",
        reconocimiento: "2026-11-12T11:46:05-06:00", finalizacion: "2026-11-12T11:50:13-06:00",
        secuencia: ["RSSI por debajo del umbral.", "Advertencia de red registrada.", "Enlace bajo supervisión.", "Nivel de señal recuperado."]
    }),
    evento({
        id: "evt-004", fecha: "2026-11-12T09:12:37-06:00", prioridad: "P1",
        area: "Área 03", origen: "Área 03 · Horno sur", evento: "Nivel de detección fuera de rango",
        duracion: "58 s", duracionSegundos: 58, resultado: "Normalizado", operador: "Operador 01",
        reconocimiento: "2026-11-12T09:12:55-06:00", finalizacion: "2026-11-12T09:13:35-06:00",
        secuencia: ["KY-026 supera el umbral.", "Alerta P1 recibida.", "Operador verifica el área.", "Lectura normalizada."]
    }),
    evento({
        id: "evt-005", fecha: "2026-11-12T08:40:12-06:00", prioridad: "P2",
        area: "Área 01", origen: "Área 01 · Horno norte", evento: "Variación térmica moderada",
        duracion: "1 min 22 s", duracionSegundos: 82, resultado: "Normalizado", operador: "Operador 02",
        reconocimiento: "2026-11-12T08:40:48-06:00", finalizacion: "2026-11-12T08:41:34-06:00",
        secuencia: ["Variación térmica detectada.", "Advertencia P2 registrada.", "Operador revisa tendencia.", "Temperatura estabilizada."]
    }),
    evento({
        id: "evt-006", fecha: "2026-11-12T07:15:09-06:00", prioridad: "Red",
        area: "Área 02", origen: "Nodo 02 · Horno central", evento: "Retransmisiones elevadas",
        duracion: "3 min 10 s", duracionSegundos: 190, resultado: "Recuperado", operador: "Sistema",
        reconocimiento: "2026-11-12T07:15:09-06:00", finalizacion: "2026-11-12T07:18:19-06:00",
        secuencia: ["Aumento de retransmisiones.", "Diagnóstico automático iniciado.", "Canal supervisado.", "Transmisión recuperada."]
    }),
    evento({
        id: "evt-007", fecha: "2026-11-11T18:05:44-06:00", prioridad: "P3",
        area: "Área 01", origen: "Área 01 · Horno norte", evento: "Registro periódico almacenado",
        duracion: "8 s", duracionSegundos: 8, resultado: "Completado", operador: "Sistema",
        reconocimiento: "2026-11-11T18:05:44-06:00", finalizacion: "2026-11-11T18:05:52-06:00",
        secuencia: ["Registro periódico generado.", "Mensaje P3 puesto en cola.", "Mensaje procesado.", "Registro almacenado."]
    })
]);

export const metricasPruebaPriorizacion = Object.freeze([
    Object.freeze({ prioridad: "P0", nombre: "Emergencia", conPrioridad: 18, sinPrioridad: 126 }),
    Object.freeze({ prioridad: "P1", nombre: "Alerta crítica", conPrioridad: 34, sinPrioridad: 132 }),
    Object.freeze({ prioridad: "P2", nombre: "Advertencia", conPrioridad: 92, sinPrioridad: 118 }),
    Object.freeze({ prioridad: "P3", nombre: "Informativo", conPrioridad: 180, sinPrioridad: 110 })
]);
