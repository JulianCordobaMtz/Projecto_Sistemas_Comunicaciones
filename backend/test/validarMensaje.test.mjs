import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validarMensaje } from "../src/validadores/mensaje.js";

function crearMensaje() {
    return {
        nodoId: "nodo-de-prueba",
        prioridad: "P1",
        tipo: "Alerta",
        contenido: "Temperatura elevada"
    };
}

const campos = ["nodoId", "prioridad", "tipo", "contenido"];

function verificarError(ejecutar, camposEsperados) {
    assert.throws(ejecutar, (error) => {
        assert.ok(error instanceof TypeError);
        assert.equal(error.estadoHttp, 400);
        assert.equal(typeof error.message, "string");
        assert.ok(error.message.trim().length > 0);
        assert.ok(Array.isArray(error.detalles));
        assert.equal(error.detalles.length, camposEsperados.length);

        const camposEnDetalles = error.detalles.map((detalle) => {
            assert.equal(typeof detalle, "string");
            assert.ok(detalle.trim().length > 0);
            const mencionados = campos.filter((campo) =>
                new RegExp(`\\b${campo}\\b`, "u").test(detalle)
            );
            assert.equal(mencionados.length, 1, "Cada detalle debe identificar un único campo conocido");
            return mencionados[0];
        });

        // Comparar listas ordenadas conserva la multiplicidad y detecta duplicados.
        assert.deepEqual(camposEnDetalles.sort(), [...camposEsperados].sort());
        return true;
    });
}

describe("Validador de mensajes", { concurrency: false }, () => {
    test("un mensaje válido devuelve los cuatro campos esperados", () => {
        assert.deepEqual(validarMensaje(crearMensaje()), {
            nodoId: "nodo-de-prueba",
            prioridad: "P1",
            tipo: "Alerta",
            contenido: "Temperatura elevada"
        });
    });

    test("recorta espacios exteriores y normaliza la prioridad sin cambiar los espacios interiores", () => {
        const mensaje = {
            nodoId: " \tnodo  externo\n ",
            prioridad: " \tp2\n ",
            tipo: " \tAlerta  térmica\n ",
            contenido: " \tTemperatura  elevada\n "
        };

        assert.deepEqual(validarMensaje(mensaje), {
            nodoId: "nodo  externo",
            prioridad: "P2",
            tipo: "Alerta  térmica",
            contenido: "Temperatura  elevada"
        });
    });

    for (const prioridad of ["P0", "P1", "P2", "P3"]) {
        test(`acepta la prioridad ${prioridad}`, () => {
            const mensaje = { ...crearMensaje(), prioridad };
            assert.deepEqual(validarMensaje(mensaje), mensaje);
        });
    }

    for (const prioridad of ["P4", "P-1", "P10", "1", "PX", "PRIORIDAD", "P 1"]) {
        test(`rechaza la prioridad inválida ${JSON.stringify(prioridad)}`, () => {
            const mensaje = { ...crearMensaje(), prioridad };
            verificarError(() => validarMensaje(mensaje), ["prioridad"]);
        });
    }

    for (const campo of campos) {
        test(`rechaza el campo obligatorio ${campo} ausente`, () => {
            const mensaje = crearMensaje();
            delete mensaje[campo];
            verificarError(() => validarMensaje(mensaje), [campo]);
        });

        for (const [nombre, valor] of [["vacío", ""], ["con solo espacios", " \t\n "]]) {
            test(`rechaza ${campo} ${nombre}`, () => {
                const mensaje = { ...crearMensaje(), [campo]: valor };
                verificarError(() => validarMensaje(mensaje), [campo]);
            });
        }

        for (const [nombre, valor] of [
            ["undefined", undefined],
            ["null", null],
            ["número", 123],
            ["booleano", true],
            ["arreglo", [crearMensaje()[campo]]],
            ["objeto", { valor: crearMensaje()[campo] }]
        ]) {
            test(`rechaza ${campo} de tipo incorrecto: ${nombre}`, () => {
                const mensaje = { ...crearMensaje(), [campo]: valor };
                verificarError(() => validarMensaje(mensaje), [campo]);
            });
        }
    }

    for (const [campo, maximo] of [["tipo", 60], ["contenido", 500]]) {
        for (const [longitud, aceptado] of [[1, false], [2, true], [maximo, true], [maximo + 1, false]]) {
            for (const conEspacios of [false, true]) {
                const sufijo = conEspacios ? " con espacios exteriores" : "";
                test(`${aceptado ? "acepta" : "rechaza"} ${campo} de longitud ${longitud}${sufijo}`, () => {
                    const texto = "a".repeat(longitud);
                    const mensaje = {
                        ...crearMensaje(),
                        [campo]: conEspacios ? ` \t${texto}\n ` : texto
                    };

                    if (aceptado) {
                        assert.deepEqual(validarMensaje(mensaje), { ...crearMensaje(), [campo]: texto });
                    } else {
                        verificarError(() => validarMensaje(mensaje), [campo]);
                    }
                });
            }
        }
    }

    test("sin argumentos produce un error de validación con los cuatro detalles", () => {
        verificarError(() => validarMensaje(), campos);
    });

    for (const [nombre, cuerpo] of [
        ["undefined", undefined],
        ["null", null],
        ["cadena", "mensaje inválido"],
        ["número", 42],
        ["booleano", true],
        ["arreglo vacío", []],
        ["arreglo con un mensaje", [crearMensaje()]],
        ["objeto vacío", {}]
    ]) {
        test(`rechaza el cuerpo ${nombre} con un error de validación identificable`, () => {
            verificarError(() => validarMensaje(cuerpo), campos);
        });
    }
});
