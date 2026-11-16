const PRIORIDADES = new Set(["P0", "P1", "P2", "P3"]);

export const validarMensaje = (datos) => {
    const errores = [];
    const nodoId = typeof datos?.nodoId === "string" ? datos.nodoId.trim() : "";
    const prioridad = typeof datos?.prioridad === "string" ? datos.prioridad.trim().toUpperCase() : "";
    const tipo = typeof datos?.tipo === "string" ? datos.tipo.trim() : "";
    const contenido = typeof datos?.contenido === "string" ? datos.contenido.trim() : "";

    if (!nodoId) errores.push("nodoId es obligatorio");
    if (!PRIORIDADES.has(prioridad)) errores.push("prioridad debe ser P0, P1, P2 o P3");
    if (tipo.length < 2 || tipo.length > 60) errores.push("tipo debe tener entre 2 y 60 caracteres");
    if (contenido.length < 2 || contenido.length > 500) errores.push("contenido debe tener entre 2 y 500 caracteres");

    if (errores.length > 0) {
        const error = new TypeError("El mensaje contiene datos inválidos");
        error.estadoHttp = 400;
        error.detalles = errores;
        throw error;
    }

    return { nodoId, prioridad, tipo, contenido };
};
