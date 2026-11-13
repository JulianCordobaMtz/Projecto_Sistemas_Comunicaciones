const FORMATO_FECHA = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric"
});

const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const buscarCampo = (nombre) => {
    const campos = document.querySelectorAll("body > div > header dl > div");

    return [...campos].find((campo) =>
        campo.querySelector("dt")?.textContent.trim().toLowerCase() === nombre
    );
};

const actualizarCampoTexto = (nombre, valor) => {
    const campo = buscarCampo(nombre);
    const destino = campo?.querySelector("dd");

    if (destino) {
        destino.textContent = valor;
    }
};

const actualizarReloj = () => {
    const ahora = new Date();
    const campoFecha = buscarCampo("fecha")?.querySelector("time");
    const campoHora = buscarCampo("hora")?.querySelector("time");

    if (campoFecha) {
        campoFecha.dateTime = ahora.toISOString().slice(0, 10);
        campoFecha.textContent = FORMATO_FECHA.format(ahora);
    }

    if (campoHora) {
        campoHora.dateTime = ahora.toISOString();
        campoHora.textContent = FORMATO_HORA.format(ahora);
    }
};

export const inicializarEncabezado = ({ conexion, modo }) => {
    actualizarCampoTexto("conexión", conexion);
    actualizarCampoTexto("modo", modo);
    actualizarReloj();

    const temporizador = window.setInterval(actualizarReloj, 1000);

    return () => window.clearInterval(temporizador);
};
