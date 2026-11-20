const FORMATO_HORA = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});

const normalizarTexto = (texto) =>
    texto.trim().toLocaleLowerCase("es-MX");

const buscarValor = (tarjeta, etiqueta) => {
    const filas = tarjeta.querySelectorAll("dl > div");
    const fila = [...filas].find(({ firstElementChild }) =>
        normalizarTexto(firstElementChild?.textContent ?? "") === normalizarTexto(etiqueta)
    );

    return fila?.querySelector("dd");
};

const obtenerNivelKy = (valor) => {
    if (valor >= 75) return "alto";
    if (valor >= 30) return "medio";
    return "bajo";
};

const obtenerEstadoEnlace = (nodo, edadSegundos) => {
    if (edadSegundos >= 15) return "Sin comunicación";
    if (nodo.rssi <= -75) return "Señal débil";
    if (nodo.estado === "degradado") return "Degradado";
    return "Conectado";
};

const obtenerAdvertencias = (horno) => {
    const advertencias = [];
    if (horno.lectura.temperatura >= horno.temperatura.umbralCritico) {
        advertencias.push("Temperatura sobre el límite");
    }
    if (horno.lectura.ky026 >= 75) {
        advertencias.push("Flama sobre el umbral");
    }
    return advertencias;
};

const obtenerEstadoHorno = (horno) => {
    if (horno.emergencia || obtenerAdvertencias(horno).length > 0) return "Crítico";
    return "Normal";
};

export const actualizarTarjetaHorno = (tarjeta, horno, nodo, ahora = new Date()) => {
    if (!tarjeta || !horno || !nodo) return;

    const ultimoDato = new Date(nodo.ultimoDato);
    const edadSegundos = Math.max(0, Math.round((ahora - ultimoDato) / 1000));
    const estadoEnlace = obtenerEstadoEnlace(nodo, edadSegundos);
    const datoDesactualizado = edadSegundos >= 15;
    const estadoGeneral = obtenerEstadoHorno(horno);
    const encabezadoEstado = tarjeta.querySelector(":scope > header > p");
    const temperatura = buscarValor(tarjeta, "Temperatura")?.querySelector("data");
    const ky026 = buscarValor(tarjeta, "Sensor KY-026")?.querySelector("data");
    const pulsadorEmergencia = buscarValor(tarjeta, "Pulsador de emergencia");
    const advertencias = buscarValor(tarjeta, "Advertencias");
    const enlace = buscarValor(tarjeta, "Enlace");
    const tiempo = buscarValor(tarjeta, "Último dato")?.querySelector("time");

    if (encabezadoEstado) encabezadoEstado.textContent = estadoGeneral;
    if (temperatura) {
        temperatura.value = horno.lectura.temperatura;
        temperatura.textContent = `${horno.lectura.temperatura.toFixed(1)} °C`;
    }
    if (ky026) {
        ky026.value = horno.lectura.ky026;
        ky026.textContent = `${horno.lectura.ky026} % · Nivel ${obtenerNivelKy(horno.lectura.ky026)}`;
    }
    if (pulsadorEmergencia) pulsadorEmergencia.textContent = horno.emergencia ? "Activado" : "No activado";
    if (advertencias) {
        const causas = obtenerAdvertencias(horno);
        advertencias.textContent = causas.length > 0 ? causas.join(" · ") : "Sin advertencias";
    }
    if (enlace) enlace.textContent = `${estadoEnlace} · ${nodo.rssi} dBm`;
    if (tiempo) {
        tiempo.dateTime = ultimoDato.toISOString();
        tiempo.textContent = `Hace ${edadSegundos} s · ${FORMATO_HORA.format(ultimoDato)}`;
    }

    [temperatura, ky026, tiempo].forEach((elemento) => {
        elemento?.classList.toggle("data-stale", datoDesactualizado);
    });
    enlace?.classList.toggle("data-offline", datoDesactualizado);
    tarjeta.dataset.estadoOperativo = estadoGeneral;
    tarjeta.dataset.estadoComunicacion = estadoEnlace;
    tarjeta.dataset.lecturaDesactualizada = String(datoDesactualizado);
    if (datoDesactualizado) {
        tiempo?.setAttribute("title", `Última lectura recibida: ${ultimoDato.toLocaleString("es-MX")}`);
    } else {
        tiempo?.removeAttribute("title");
    }
};
