const crearLectura = (temperatura, ky026, estado = "normal") =>
    Object.freeze({ temperatura, ky026, estado });

export const estadoSistema = Object.freeze({
    conexion: "En línea",
    modo: "Automático",
    hornos: Object.freeze([
        Object.freeze({
            id: "horno-norte",
            area: "Área 01",
            nombre: "Horno norte",
            nodoId: "nodo-01",
            lectura: crearLectura(32.4, 18),
            temperatura: Object.freeze({
                minima: 29.8,
                promedio: 31.5,
                maxima: 33.1,
                umbralCritico: 40
            }),
            emergencia: false
        }),
        Object.freeze({
            id: "horno-central",
            area: "Área 02",
            nombre: "Horno central",
            nodoId: "nodo-02",
            lectura: crearLectura(41.8, 86, "critico"),
            temperatura: Object.freeze({
                minima: 31.2,
                promedio: 36.7,
                maxima: 42.1,
                umbralCritico: 40
            }),
            emergencia: true
        }),
        Object.freeze({
            id: "horno-sur",
            area: "Área 03",
            nombre: "Horno sur",
            nodoId: "nodo-03",
            lectura: crearLectura(29.6, 34, "advertencia"),
            temperatura: Object.freeze({
                minima: 27.9,
                promedio: 29.1,
                maxima: 31.4,
                umbralCritico: 40
            }),
            emergencia: false
        })
    ]),
    nodos: Object.freeze([
        Object.freeze({
            id: "nodo-01",
            nombre: "Nodo 01",
            area: "Horno norte",
            estado: "estable",
            rssi: -58,
            latencia: 25,
            perdidas: 0,
            retransmisiones: 0,
            ultimoPaquete: 1
        }),
        Object.freeze({
            id: "nodo-02",
            nombre: "Nodo 02",
            area: "Horno central",
            estado: "estable",
            rssi: -61,
            latencia: 31,
            perdidas: 0.8,
            retransmisiones: 1,
            ultimoPaquete: 2
        }),
        Object.freeze({
            id: "nodo-03",
            nombre: "Nodo 03",
            area: "Horno sur",
            estado: "degradado",
            rssi: -76,
            latencia: 75,
            perdidas: 3.4,
            retransmisiones: 4,
            ultimoPaquete: 5
        })
    ]),
    incidentes: Object.freeze([
        Object.freeze({
            id: "incidente-001",
            prioridad: "P0",
            tipo: "emergencia",
            hornoId: "horno-central",
            titulo: "Pulsador de emergencia activado",
            estado: "sin-atender",
            inicio: "2026-11-12T14:34:51-06:00"
        }),
        Object.freeze({
            id: "incidente-002",
            prioridad: "P1",
            tipo: "alerta",
            hornoId: "horno-central",
            titulo: "Temperatura sobre el límite",
            estado: "activo",
            inicio: "2026-11-12T14:34:26-06:00"
        })
    ])
});

export const obtenerHorno = (hornoId) =>
    estadoSistema.hornos.find(({ id }) => id === hornoId);

export const obtenerNodo = (nodoId) =>
    estadoSistema.nodos.find(({ id }) => id === nodoId);

export const obtenerIncidentesActivos = () =>
    estadoSistema.incidentes.filter(({ estado }) => estado !== "resuelto");
