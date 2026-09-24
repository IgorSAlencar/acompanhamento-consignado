// Exporta a visao atual da Rotina Diaria da Equipe para CSV, com valores cheios (sem abreviar)
import { exportarCsv } from "./exportar.js";
import { dataCurta, diaSemana } from "./formato.js";

const ROTULOS_PAIS = { gerencia: "Ger. Gestão", coordenacao: "Ger. Comercial III" };

const arredondar = (valor, casas) => Number(valor.toFixed(casas));

export function exportarRotina({ dados, linhas, metrica, chaveMetrica, nomeMetrica, dataIni, dataFim }) {
    const casas = metrica.casasCsv ?? 0;
    const colunas = [
        ...dados.pais.map((n) => ({ rotulo: ROTULOS_PAIS[n], valor: (l) => l[`pai_${n}`] || "" })),
        { rotulo: dados.rotulo, valor: (l) => l.descricao },
        { rotulo: "Lojas", valor: (l) => l.qtd_lojas },
        { rotulo: "Dias úteis sem tentativa", valor: (l) => l.resumo.semTentativa },
        { rotulo: "Tentativas", valor: (l) => l.resumo.tent },
        { rotulo: "Conversão (%)", valor: (l) => arredondar(l.resumo.conversao, 1) },
        { rotulo: "Averbado (R$)", valor: (l) => arredondar(l.resumo.vlr, 2) },
        { rotulo: "Não averbado (R$)", valor: (l) => arredondar(l.resumo.pendente, 2) },
        ...dados.dias.map((dia) => ({
            rotulo: `${nomeMetrica} ${dataCurta(dia)} (${diaSemana(dia)})`,
            valor: (l) => arredondar(metrica.valor(l.dias[dia], l), casas),
        })),
    ];
    const periodo = `${dataIni.replaceAll("-", "")}_${dataFim.replaceAll("-", "")}`;
    exportarCsv(`rotina_${dados.nivel}_${chaveMetrica}_${periodo}.csv`, colunas, linhas);
}
