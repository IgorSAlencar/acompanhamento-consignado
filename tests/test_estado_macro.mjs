import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {APP_CONFIG: {dataInicio: "2026-09-01", dataFim: "2026-09-24"}};
const {estado, parametros, parametrosDu, nivelDerivado} = await import("../static/js/estado.js");

test("abertura comercial nao envia escopo macro", () => {
    assert.equal(estado.escopo, "comercial");
    assert.equal(parametros().escopo, undefined);
    assert.equal(parametrosDu().escopo, undefined);
    assert.equal(nivelDerivado(), "gerencia");
});

test("macro propaga segmento e hierarquia para todas as abas", () => {
    estado.escopo = "macro";
    assert.equal(nivelDerivado(), "segmento");
    estado.segmento = "Casas Bahia";
    estado.gerencia = "2";
    for (const params of [parametros(), parametrosDu()]) {
        assert.equal(params.escopo, "macro");
        assert.equal(params.segmento, "Casas Bahia");
        assert.equal(params.gerencia, "2");
    }
    assert.equal(nivelDerivado(), "coordenacao");
});
