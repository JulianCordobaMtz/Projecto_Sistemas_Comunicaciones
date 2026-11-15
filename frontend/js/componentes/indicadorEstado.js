const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

export const actualizarIndicadorIncidentes = (incidentes, hornos) => {
    const activos = incidentes.filter(({ estado }) => estado !== "resuelto");
    const emergencias = activos.filter(({ prioridad }) => prioridad === "P0");
    const indicadorGlobal = document.querySelector("body > div > header > p[role='status']");
    const contador = document.querySelector(".incident-panel > header data");
    const lista = document.querySelector(".incident-list");
    const vacio = document.querySelector(".incident-empty");

    if (indicadorGlobal) {
        indicadorGlobal.textContent = emergencias.length === 1
            ? "Una emergencia activa"
            : emergencias.length > 1
                ? `${emergencias.length} emergencias activas`
                : "Sin emergencias activas";
    }

    if (contador) {
        contador.value = activos.length;
        contador.textContent = activos.length === 1 ? "1 incidente" : `${activos.length} incidentes`;
    }

    if (lista) lista.hidden = activos.length === 0;
    if (vacio) vacio.hidden = activos.length !== 0;

    const emergencia = emergencias[0];
    const tarjetaEmergencia = document.querySelector(".emergency-card");
    if (tarjetaEmergencia) tarjetaEmergencia.hidden = !emergencia;

    if (emergencia && tarjetaEmergencia) {
        const horno = hornos.find(({ id }) => id === emergencia.hornoId);
        const hora = tarjetaEmergencia.querySelector("time");
        const ubicacion = tarjetaEmergencia.querySelector(".emergency-location");
        const estado = [...tarjetaEmergencia.querySelectorAll("dl > div")]
            .find((fila) => fila.querySelector("dt")?.textContent.trim() === "Estado")
            ?.querySelector("dd");

        if (hora) {
            hora.dateTime = emergencia.inicio;
            hora.textContent = FORMATO_HORA.format(new Date(emergencia.inicio));
        }
        if (ubicacion && horno) {
            ubicacion.querySelector("span").textContent = horno.area;
            ubicacion.querySelector("strong").textContent = horno.nombre;
        }
        if (estado) estado.textContent = emergencia.estado === "sin-atender" ? "Sin atender" : "Reconocida";
    }

    const alerta = activos.find(({ prioridad }) => prioridad === "P1");
    const tarjetaAlerta = document.querySelector(".alert-card");
    if (tarjetaAlerta) tarjetaAlerta.hidden = !alerta;

    if (alerta && tarjetaAlerta) {
        const horno = hornos.find(({ id }) => id === alerta.hornoId);
        const hora = tarjetaAlerta.querySelector("time");
        const detalle = tarjetaAlerta.querySelector(":scope > div");

        if (hora) {
            hora.dateTime = alerta.inicio;
            hora.textContent = FORMATO_HORA.format(new Date(alerta.inicio));
        }
        if (horno && detalle) {
            detalle.querySelector("span").textContent = `${horno.area} · ${horno.nombre}`;
            detalle.querySelector("strong").textContent = `${horno.lectura.temperatura.toFixed(1)} °C / límite ${horno.temperatura.umbralCritico} °C`;
        }
    }
};
