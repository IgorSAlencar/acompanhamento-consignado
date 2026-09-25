// Exporta a visao atual da Equipe para CSV, com valores cheios (sem abreviar)
import { exportarCsv } from "./exportar.js";

const ROTULOS_PAIS = { gerencia: "Ger. Gestão", coordenacao: "Ger. Comercial III" };
const PRODUTOS = [
    ["INSS", "INSS"],
    ["PRIVADO", "Privado"],
    ["PUBLICO", "Público"],
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
        { rotulo: `${nome} conversão (%)`, valor: (l) => p(l).pct_conversao },
        { rotulo: `${nome} aguardando averbação (R$)`, valor: (l) => reais(p(l).vlr_aguardando) },
    ];
}

export function exportarEquipe({ dados, linhas, dataIni, dataFim }) {
    const colunas = [
        ...dados.pais.map((nivel) => ({
            rotulo: ROTULOS_PAIS[nivel],
            valor: (l) => (nivel === "gerencia" ? l.pai_gerencia : l.pai_coordenacao) || "",
        })),
        { rotulo: dados.rotulo, valor: (l) => l.descricao },
        { rotulo: "Lojas com produção", valor: (l) => l.qtd_lojas_producao },
        { rotulo: "Lojas ativas", valor: (l) => l.qtd_lojas },
        { rotulo: "Cobertura (%)", valor: (l) => l.pct_cobertura },
        ...PRODUTOS.flatMap(([chave, nome]) => colunasProduto(chave, nome)),
    ];
    const periodo = `${dataIni.replaceAll("-", "")}_${dataFim.replaceAll("-", "")}`;
    exportarCsv(`equipe_${dados.nivel}_${periodo}.csv`, colunas, linhas);
}
