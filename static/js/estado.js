// Estado global dos filtros do cockpit
export const estado = {
    modo: "geral", // "geral" (abas de produto) ou "du" (analise por dia util)
    produto: "",
    gerencia: "",
    coordenacao: "",
    supervisao: "",
    dataIni: window.APP_CONFIG.dataInicio,
    dataFim: window.APP_CONFIG.dataHoje,
    nivelEquipe: "gerencia", // visao da secao Equipe (pode ser trocada pelo usuario)
    // Aba Dia Util: produto proprio, metrica, visao do grafico, meses comparados e DU limite
    du: {
        produto: "",
        metrica: "vlr",    // vlr | qtd | lojas | tentativas
        visao: "acum",     // acum | dia
        comparar: null,    // AAAAMM dos meses de comparacao; null = janela de 3 meses
        du: "",            // vazio = DU de D-1 / ontem (definido pelo backend)
        nivel: "gerencia", // nivel do ranking
    },
};

export function parametros() {
    return {
        produto: estado.produto,
        gerencia: estado.gerencia,
        coordenacao: estado.coordenacao,
        supervisao: estado.supervisao,
        data_ini: estado.dataIni,
        data_fim: estado.dataFim,
    };
}

// Parametros da aba Dia Util (hierarquia compartilhada + controles proprios)
export function parametrosDu() {
    return {
        produto: estado.du.produto,
        gerencia: estado.gerencia,
        coordenacao: estado.coordenacao,
        supervisao: estado.supervisao,
        comparar: (estado.du.comparar || []).join(","),
        du: estado.du.du,
    };
}

// Nivel sugerido pela profundidade dos filtros ativos (secao Equipe)
export function nivelDerivado() {
    if (estado.coordenacao || estado.supervisao) return "supervisao";
    if (estado.gerencia) return "coordenacao";
    return "gerencia";
}

// Na aba Dia Util o ranking tem nivel Loja: ao filtrar um Ger. Comercial, mostra as lojas
export function nivelDerivadoDu() {
    if (estado.supervisao) return "loja";
    if (estado.coordenacao) return "supervisao";
    if (estado.gerencia) return "coordenacao";
    return "gerencia";
}
