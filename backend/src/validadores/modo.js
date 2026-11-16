const MODOS_PERMITIDOS = new Set(["simulacion", "datos-externos"]);

export const validarModo = (datos) => {
    const modo = typeof datos?.modo === "string"
        ? datos.modo.trim().toLocaleLowerCase("es-MX")
        : "";

    if (!MODOS_PERMITIDOS.has(modo)) {
        const error = new TypeError("El modo debe ser simulacion o datos-externos");
        error.estadoHttp = 400;
        throw error;
    }

    return modo;
};
