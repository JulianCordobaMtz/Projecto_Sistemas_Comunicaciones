export const validarOperador = (datos) => {
    const operador = typeof datos?.operador === "string" ? datos.operador.trim() : "";

    if (operador.length < 2 || operador.length > 80) {
        const error = new TypeError("operador es obligatorio y debe tener entre 2 y 80 caracteres");
        error.estadoHttp = 400;
        throw error;
    }

    return operador;
};
