const numeroPositivo = (valor, respaldo) => {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : respaldo;
};

export const configuracion = Object.freeze({
    puerto: numeroPositivo(process.env.PORT, 3000),
    intervaloSimulacion: numeroPositivo(process.env.SIMULATION_INTERVAL_MS, 2000),
    origenPermitido: process.env.ALLOWED_ORIGIN ?? "*"
});
