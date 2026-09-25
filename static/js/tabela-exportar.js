// Exporta o detalhamento diario por produto para CSV, com valores cheios (sem abreviar)
import { exportarCsv } from "./exportar.js";
import { dataCurta } from "./formato.js";

const PRODUTOS = [
    ["INSS", "INSS"],
    ["PUBLICO", "Público"],
    ["PRIVADO", "Privado"],
];

const reais = (valor) => Number((valor || 0).toFixed(2));

function colunasProduto(chave, nome) {
    const p = (l) => l.produtos[chave];
    return [
        { rotulo: `${nome} averbado (R$)`, valor: (l) => reais(p(l).vlr) },
        { rotulo: `${nome} operações`, valor: (l) => p(l).qtd },
        { rotulo: `${nome} lojas`, valor: (l) => p(l).lojas },
        { rotulo: `${nome} tentativas`, valor: (l) => p(l).tentativas },
        { rotulo: `${nome} convertidas`, valor: (l) => p(l).convertidas },
    ];
}

export function exportarTabela({ linhas, dataIni, dataFim }) {
    const colunas = [
        { rotulo: "Dia", valor: (l) => dataCurta(l.dia) },
        ...PRODUTOS.flatMap(([chave, nome]) => colunasProduto(chave, nome)),
        { rotulo: "Total averbado (R$)", valor: (l) => reais(l.total_vlr) },
        { rotulo: "Total operações", valor: (l) => l.total_qtd },
        { rotulo: "Total lojas", valor: (l) => l.total_lojas },
        { rotulo: "Aguardando averbação (R$)", valor: (l) => reais(l.vlr_aguardando) },
        { rotulo: "Aguardando averbação (qtd)", valor: (l) => l.qtd_aguardando },
        { rotulo: "Aguardando averbação (lojas)", valor: (l) => l.lojas_aguardando },
        { rotulo: "Não averbado (R$)", valor: (l) => reais(l.vlr_nao_averbado) },
        { rotulo: "Não averbado (qtd)", valor: (l) => l.qtd_nao_averbado },
        { rotulo: "Não averbado (lojas)", valor: (l) => l.lojas_nao_averbado },
    ];
    const periodo = `${dataIni.replaceAll("-", "")}_${dataFim.replaceAll("-", "")}`;
    exportarCsv(`detalhamento_diario_${periodo}.csv`, colunas, linhas);
}
