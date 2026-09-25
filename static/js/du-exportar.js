// Exporta o ranking da aba Dia Util para CSV (valores cheios, separador ;)
import { NOMES_METRICA } from "./du-grafico.js";
import { estado } from "./estado.js";
import { exportarCsv } from "./exportar.js";

const reais = (valor) => Number((valor || 0).toFixed(2));

export function exportarRankingDu({ dados, linhas }) {
    const du = dados.du;
    const nome = NOMES_METRICA[estado.du.metrica];
    const pais = {
        gerencia: { rotulo: "Ger. Gestão", valor: (l) => l.pai_gerencia || "" },
        coordenacao: { rotulo: "Ger. Comercial III", valor: (l) => l.pai_coordenacao || "" },
        supervisao: { rotulo: "Ger. Comercial", valor: (l) => l.pai_supervisao || "" },
    };
    const colunas = [
        ...(dados.pais || []).map((n) => pais[n]),
        { rotulo: dados.rotulo, valor: (l) => l.descricao },
        { rotulo: `${nome} no DU ${du}`, valor: (l) => reais(l.atual_du) },
        { rotulo: `Média do DU ${du} nos meses anteriores`, valor: (l) => reais(l.media_du) },
        { rotulo: `Acumulado até DU ${du}`, valor: (l) => reais(l.atual_acum) },
        { rotulo: `Média acumulada dos meses anteriores até DU ${du}`, valor: (l) => reais(l.media_acum) },
        { rotulo: "Diferença (mês atual − média)", valor: (l) => reais(l.diferenca) },
        { rotulo: "Desvio vs meses anteriores (%)", valor: (l) => (l.desvio_pct == null ? "" : l.desvio_pct) },
        { rotulo: "Lojas produtivas", valor: (l) => l.lojas_acum },
        { rotulo: "Média lojas produtivas", valor: (l) => l.media_lojas },
        { rotulo: "Último DU com produção", valor: (l) => l.ultimo_du },
        { rotulo: "DUs sem produzir", valor: (l) => l.dus_parado },
        { rotulo: "Status", valor: (l) => l.status },
    ];
    exportarCsv(
        `dia_util_${dados.nivel}_${estado.du.metrica}_${dados.mes_ref}_du${du}.csv`,
        colunas,
        linhas,
    );
}
