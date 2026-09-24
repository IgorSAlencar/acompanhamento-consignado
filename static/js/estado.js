// Estado global dos filtros do cockpit
export const estado = {
    produto: "",
    gerencia: "",
    coordenacao: "",
    supervisao: "",
    dataIni: window.APP_CONFIG.dataInicio,
    dataFim: window.APP_CONFIG.dataHoje,
    nivelEquipe: "gerencia", // visao da secao Equipe (pode ser trocada pelo usuario)
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

// Nivel sugerido pela profundidade dos filtros ativos
export function nivelDerivado() {
    if (estado.coordenacao || estado.supervisao) return "supervisao";
    if (estado.gerencia) return "coordenacao";
    return "gerencia";
}
