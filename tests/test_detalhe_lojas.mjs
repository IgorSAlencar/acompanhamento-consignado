import assert from "node:assert/strict";
import test from "node:test";
import { agrupar, temMovimento, colunasGrupo } from "../static/js/detalhe-agrupar.js";
import { htmlLinhaTotal } from "../static/js/detalhe-total.js";

const loja = (chave, extra = {}) => ({
    chave_loja: chave, gerencia: "Gestão", coordenacao: "III", supervisao: "Comercial",
    ativa: true, qtd_tentativas: 0, qtd_convertidas: 0,
    qtd_averbado: 0, vlr_averbado: 0, qtd_aguardando: 0, vlr_aguardando: 0,
    qtd_nao_averbado: 0, vlr_nao_averbado: 0, ...extra,
});

test("produção conta lojas distintas, inclusive inativas, e exclui só tentativas", () => {
    const lojas = [
        loja(1, { qtd_averbado: 3, vlr_averbado: 300 }),
        loja(2, { ativa: false, qtd_averbado: 2, vlr_averbado: 200 }),
        loja(3, { qtd_tentativas: 10 }),
        loja(4),
    ];
    const grupo = agrupar(lojas, "gerencia")[0];
    assert.equal(grupo.qtd_averbado, 5);
    assert.equal(grupo.qtd_lojas_mov, 2);
    assert.deepEqual(lojas.filter(temMovimento).map(l => l.chave_loja), [1, 2]);
    const colunas = colunasGrupo("gerencia", { situacao: "AVERBADO" });
    assert.match(htmlLinhaTotal({tipo: "grupos", colunas}, [grupo], "gerencia"), /2<small>com consignado averbado/);
});

test("a mesma chave não aumenta a contagem de lojas do grupo", () => {
    const repetida = loja(1, { qtd_averbado: 2 });
    assert.equal(agrupar([repetida, repetida], "gerencia")[0].qtd_lojas_mov, 1);
});

test("lojas com movimento seguem o assunto de cada tela", () => {
    const lojas = [
        loja(1, { qtd_averbado: 2 }), loja(2, { qtd_aguardando: 1 }),
        loja(3, { qtd_nao_averbado: 1 }), loja(4, { qtd_tentativas: 5, ativa: false }),
    ];
    for (const [situacao, chaves] of [["AVERBADO", [1]], ["AGUARDANDO AVERBACAO", [2]], ["NAO AVERBADO", [3]], ["PENDENTE", [2, 3]]]) {
        assert.deepEqual(lojas.filter(l => temMovimento(l, "", situacao)).map(l => l.chave_loja), chaves);
        assert.equal(agrupar(lojas, "gerencia", "", situacao)[0].qtd_lojas_mov, chaves.length);
    }
    assert.deepEqual(lojas.filter(l => temMovimento(l, "tentativas")).map(l => l.chave_loja), [4]);
    assert.equal(agrupar(lojas, "gerencia", "tentativas")[0].qtd_lojas_mov, 1);
    assert.deepEqual(lojas.filter(temMovimento).map(l => l.chave_loja), [1]);
    assert.equal(agrupar(lojas, "gerencia")[0].qtd_lojas_mov, 1);
});

test("legenda e rodapé identificam a contagem correspondente ao contexto", () => {
    const lojas = [
        loja(1, { qtd_averbado: 3 }),
        loja(2, { qtd_aguardando: 1, qtd_tentativas: 8 }),
        loja(3, { qtd_nao_averbado: 2, ativa: false }),
    ];
    for (const [filtros, quantidade, legenda] of [
        [{}, 1, "com consignado averbado"],
        [{foco: "tentativas"}, 1, "com tentativas"],
        [{situacao: "AGUARDANDO AVERBACAO"}, 1, "aguardando averbação"],
        [{situacao: "NAO AVERBADO"}, 1, "com não averbados"],
        [{situacao: "PENDENTE"}, 2, "com pendências"],
    ]) {
        const grupo = agrupar(lojas, "gerencia", filtros.foco, filtros.situacao)[0];
        const colunas = colunasGrupo("gerencia", filtros);
        const coluna = colunas.find(c => c.chave === "qtd_lojas");
        assert.equal(coluna.rotulo, "Lojas c/ movimento");
        assert.equal(coluna.valor(grupo), quantidade);
        assert.ok(htmlLinhaTotal({tipo: "grupos", colunas}, [grupo], "gerencia").includes(`${quantidade}<small>${legenda}`));
    }
});
