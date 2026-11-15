export const crearEstadoInicial = () => {
    const ahora = new Date();

    return {
        sistema: {
            conexion: "En línea",
            modo: "Simulación",
            actualizadoEn: ahora.toISOString()
        },
        hornos: [
            {
                id: "horno-norte", area: "Área 01", nombre: "Horno norte", nodoId: "nodo-01",
                temperatura: 32.4, ky026: 18, estado: "normal", emergencia: false,
                umbrales: { temperaturaCritica: 40, ky026Alto: 75 }
            },
            {
                id: "horno-central", area: "Área 02", nombre: "Horno central", nodoId: "nodo-02",
                temperatura: 41.8, ky026: 86, estado: "critico", emergencia: true,
                umbrales: { temperaturaCritica: 40, ky026Alto: 75 }
            },
            {
                id: "horno-sur", area: "Área 03", nombre: "Horno sur", nodoId: "nodo-03",
                temperatura: 29.6, ky026: 34, estado: "advertencia", emergencia: false,
                umbrales: { temperaturaCritica: 40, ky026Alto: 75 }
            }
        ],
        nodos: [
            { id: "nodo-01", nombre: "Nodo 01", area: "Horno norte", estado: "estable", rssi: -58, latencia: 25, perdidas: 0, retransmisiones: 0, ultimoDato: ahora.toISOString() },
            { id: "nodo-02", nombre: "Nodo 02", area: "Horno central", estado: "estable", rssi: -61, latencia: 31, perdidas: 0.8, retransmisiones: 1, ultimoDato: ahora.toISOString() },
            { id: "nodo-03", nombre: "Nodo 03", area: "Horno sur", estado: "degradado", rssi: -76, latencia: 75, perdidas: 3.4, retransmisiones: 4, ultimoDato: ahora.toISOString() }
        ],
        incidentes: [
            { id: "incidente-001", prioridad: "P0", tipo: "emergencia", hornoId: "horno-central", titulo: "Emergencia activa", estado: "sin-atender", inicio: new Date(ahora.getTime() - 42000).toISOString() },
            { id: "incidente-002", prioridad: "P1", tipo: "alerta", hornoId: "horno-central", titulo: "Temperatura sobre el límite", estado: "activo", inicio: new Date(ahora.getTime() - 67000).toISOString() }
        ],
        cola: [
            { prioridad: "P0", nombre: "Emergencia", pendientes: 0, latenciaPromedio: 18 },
            { prioridad: "P1", nombre: "Alerta crítica", pendientes: 0, latenciaPromedio: 34 },
            { prioridad: "P2", nombre: "Advertencia", pendientes: 3, latenciaPromedio: 92 },
            { prioridad: "P3", nombre: "Informativo", pendientes: 6, latenciaPromedio: 180 }
        ]
    };
};
