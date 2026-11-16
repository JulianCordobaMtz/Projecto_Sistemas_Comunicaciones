const URL_API = "http://localhost:3000/api";

const enviar = async (ruta, opciones) => {
    const respuesta = await fetch(`${URL_API}${ruta}`, {
        ...opciones,
        headers: { "Content-Type": "application/json", ...opciones?.headers }
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
        throw new Error(datos.error ?? `La solicitud falló con estado ${respuesta.status}`);
    }
    return datos;
};

export const reconocerIncidente = (incidenteId, operador) => enviar(
    `/incidentes/${encodeURIComponent(incidenteId)}/reconocer`,
    { method: "PATCH", body: JSON.stringify({ operador }) }
);

export const cerrarIncidente = (incidenteId, operador) => enviar(
    `/incidentes/${encodeURIComponent(incidenteId)}/cerrar`,
    { method: "PATCH", body: JSON.stringify({ operador }) }
);
