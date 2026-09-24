// Agrupa as lojas do detalhe pelos niveis hierarquicos (Ger. Gestao > Ger. Comercial III > Ger. Comercial > Loja)
import { COLUNAS_LOJAS } from "./detalhe-colunas.js";
import { inteiro } from "./formato.js";

export const NIVEIS = [
    { chave: "gerencia", rotulo: "Ger. Gestão" },
    { chave: "coordenacao", rotulo: "Ger. Comercial III" },
    { chave: "supervisao", rotulo: "Ger. Comercial" },
    { chave: "loja", rotulo: "Loja" },
];

const CAMPOS_SOMA = [
    "qtd_tentativas", "qtd_convertidas", "qtd_averbado", "vlr_averbado",
    "qtd_aguardando", "vlr_aguardando", "qtd_nao_averbado", "vlr_nao_averbado",
];

const temMovimento = (l) => l.qtd_tentativas > 0 || l.qtd_averbado + l.qtd_aguardando + l.qtd_nao_averbado > 0;

export const indiceNivel = (chave) => NIVEIS.findIndex((n) => n.chave === chave);

// Primeiro nivel abaixo do filtro mais profundo aplicado
export function nivelInicial(filtros) {
    if (filtros.loja || filtros.supervisao) return "loja";
    if (filtros.coordenacao) return "supervisao";
    if (filtros.gerencia) return "coordenacao";
    return "gerencia";
}

export function niveisDisponiveis(filtros) {
    return NIVEIS.slice(indiceNivel(nivelInicial(filtros)));
}

export function filtrarPorTrilha(lojas, trilha) {
    return lojas.filter((l) => trilha.every((passo) => l[passo.nivel] === passo.valor));
}

export function agrupar(lojas, nivel) {
    const pais = NIVEIS.slice(0, indiceNivel(nivel)).map((n) => n.chave);
    const grupos = new Map();
    lojas.forEach((l) => {
        const chave = l[nivel] || "Sem hierarquia";
        if (!grupos.has(chave)) {
            const base = { [nivel]: chave, qtd_lojas: 0, qtd_lojas_mov: 0 };
            pais.forEach((p) => { base[p] = l[p]; });
            CAMPOS_SOMA.forEach((c) => { base[c] = 0; });
            grupos.set(chave, base);
        }
        const g = grupos.get(chave);
        g.qtd_lojas += 1;
        if (temMovimento(l)) g.qtd_lojas_mov += 1;
        CAMPOS_SOMA.forEach((c) => { g[c] += l[c]; });
    });
    return [...grupos.values()].map((g) => ({
        ...g,
        pct_conversao: g.qtd_tentativas ? (100 * g.qtd_convertidas) / g.qtd_tentativas : 0,
    }));
}

const COLUNAS_METRICAS = COLUNAS_LOJAS.filter((c) => c.metrica);

export function colunasGrupo(nivel) {
    const hierarquia = COLUNAS_LOJAS.filter((c) => c.hierarquia && indiceNivel(c.chave) <= indiceNivel(nivel))
        .map((c) => (c.chave === nivel ? { ...c, classe: "texto-esquerda celula-nome-grupo" } : c));
    const lojas = {
        chave: "qtd_lojas", rotulo: "Lojas c/ movimento", valor: (g) => g.qtd_lojas_mov,
        html: (g) => `${inteiro(g.qtd_lojas_mov)}<small>de ${inteiro(g.qtd_lojas)}</small>`,
        csv: (g) => g.qtd_lojas_mov,
    };
    return [...hierarquia, lojas, ...COLUNAS_METRICAS];
}
