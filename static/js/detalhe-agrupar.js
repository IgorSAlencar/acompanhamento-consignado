// Agrupa as lojas do detalhe pelos niveis hierarquicos (Ger. Gestao > Ger. Comercial III > Ger. Comercial > Loja)
import { COLUNAS_LOJAS, PRODUTOS, colunasMetricas } from "./detalhe-colunas.js";
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

export function temMovimento(l, foco = "", situacao = "") {
    if (foco === "tentativas") return l.qtd_tentativas > 0;
    if (situacao === "AVERBADO") return l.qtd_averbado > 0;
    if (situacao === "AGUARDANDO AVERBACAO") return l.qtd_aguardando > 0;
    if (situacao === "NAO AVERBADO") return l.qtd_nao_averbado > 0;
    if (situacao === "PENDENTE") return l.qtd_aguardando + l.qtd_nao_averbado > 0;
    return l.qtd_averbado > 0;
}

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

function niveisFixados(filtros = {}, trilha = []) {
    const fixados = new Set(trilha.map((passo) => passo.nivel));
    if (filtros.loja || filtros.supervisao) {
        ["gerencia", "coordenacao", "supervisao"].forEach((nivel) => fixados.add(nivel));
    } else if (filtros.coordenacao) {
        ["gerencia", "coordenacao"].forEach((nivel) => fixados.add(nivel));
    } else if (filtros.gerencia) {
        fixados.add("gerencia");
    }
    return fixados;
}

function hierarquiaVisivel(coluna, nivelAtual, fixados) {
    if (!coluna.hierarquia || coluna.chave === nivelAtual) return true;
    return !fixados.has(coluna.chave);
}

function produtoZerado() {
    return { qtd_tentativas: 0, qtd_convertidas: 0, pct_conversao: 0 };
}

function somarProdutos(grupo, loja) {
    if (!loja.produtos) return;
    if (!grupo.produtos) {
        grupo.produtos = Object.fromEntries(PRODUTOS.map((p) => [p, produtoZerado()]));
    }
    PRODUTOS.forEach((p) => {
        const origem = loja.produtos[p] || produtoZerado();
        grupo.produtos[p].qtd_tentativas += origem.qtd_tentativas || 0;
        grupo.produtos[p].qtd_convertidas += origem.qtd_convertidas || 0;
    });
}

function fecharConversao(produtos) {
    PRODUTOS.forEach((p) => {
        const item = produtos[p];
        item.pct_conversao = item.qtd_tentativas ? (100 * item.qtd_convertidas) / item.qtd_tentativas : 0;
    });
}

export function agrupar(lojas, nivel, foco = "", situacao = "") {
    const pais = NIVEIS.slice(0, indiceNivel(nivel)).map((n) => n.chave);
    const grupos = new Map();
    const lojasMovimento = new Map();
    lojas.forEach((l) => {
        const chave = l[nivel] || "Sem hierarquia";
        if (!grupos.has(chave)) {
            const base = { [nivel]: chave, qtd_lojas: 0, qtd_lojas_ativas: 0, qtd_lojas_mov: 0 };
            pais.forEach((p) => { base[p] = l[p]; });
            CAMPOS_SOMA.forEach((c) => { base[c] = 0; });
            grupos.set(chave, base);
            lojasMovimento.set(chave, new Set());
        }
        const g = grupos.get(chave);
        g.qtd_lojas += 1;
        if (l.ativa) {
            g.qtd_lojas_ativas += 1;
        }
        if (temMovimento(l, foco, situacao)) lojasMovimento.get(chave).add(l.chave_loja);
        g.qtd_lojas_mov = lojasMovimento.get(chave).size;
        CAMPOS_SOMA.forEach((c) => { g[c] += l[c]; });
        somarProdutos(g, l);
    });
    return [...grupos.values()].map((g) => {
        if (g.produtos) fecharConversao(g.produtos);
        return {
            ...g,
            pct_conversao: g.qtd_tentativas ? (100 * g.qtd_convertidas) / g.qtd_tentativas : 0,
        };
    });
}

export function colunasGrupo(nivel, filtros = {}, trilha = []) {
    const fixados = niveisFixados(filtros, trilha);
    const hierarquia = COLUNAS_LOJAS.filter((c) =>
        c.hierarquia && indiceNivel(c.chave) <= indiceNivel(nivel) && hierarquiaVisivel(c, nivel, fixados))
        .map((c) => (c.chave === nivel ? { ...c, classe: "texto-esquerda celula-nome-grupo" } : c));
    const descricoes = {
        "AGUARDANDO AVERBACAO": "aguardando averbação",
        "NAO AVERBADO": "com não averbados",
        "PENDENTE": "com pendências",
    };
    const descricao = filtros.foco === "tentativas" ? "com tentativas"
        : descricoes[filtros.situacao] || "com consignado averbado";
    const lojas = {
        chave: "qtd_lojas", rotulo: "Lojas c/ movimento", valor: (g) => g.qtd_lojas_mov,
        html: (g) => `${inteiro(g.qtd_lojas_mov)}<small>${descricao}</small>`,
        csv: (g) => g.qtd_lojas_mov,
    };
    return [...hierarquia, lojas, ...colunasMetricas(filtros)];
}

export function colunasLojas(filtros = {}, trilha = []) {
    const fixados = niveisFixados(filtros, trilha);
    const identificacao = COLUNAS_LOJAS.filter((c) => !c.metrica && hierarquiaVisivel(c, "loja", fixados));
    return [...identificacao, ...colunasMetricas(filtros)];
}
