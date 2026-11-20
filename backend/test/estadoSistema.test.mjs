import assert from "node:assert/strict";
import test from "node:test";

import { estadoSistema } from "../src/servicios/estadoSistema.js";

test("conserva el reconocimiento durante las lecturas simuladas", () => {
    estadoSistema.reconocerIncidente("incidente-001", "Operador de prueba");
    estadoSistema.simularSiguienteLectura(new Date());

    const incidente = estadoSistema
        .obtenerIncidentes()
        .find(({ id }) => id === "incidente-001");

    assert.equal(incidente.estado, "reconocido");
    assert.equal(incidente.operadorReconocimiento, "Operador de prueba");
    assert.ok(incidente.reconocidoEn);
});
