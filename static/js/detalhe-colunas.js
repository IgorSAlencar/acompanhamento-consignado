// Colunas das tabelas do painel de detalhe (lojas, contratos e tentativas da loja)
import { blocoValor, dataCurta, diaSemana, inteiro, moedaCentavos, percentual } from "./formato.js";

export const NOMES_PRODUTO = { INSS: "INSS", PRIVADO: "Privado", PUBLICO: "Público" };

export const NOMES_SITUACAO = {
    "AVERBADO": "Averbado",
    "AGUARDANDO AVERBACAO": "Aguardando averbação",
    "NAO AVERBADO": "Não averbado",
    "PENDENTE": "Não averbada (aguardando averbação + não averbado)",
};

const CLASSE_SITUACAO = {
    "AVERBADO": "selo-ok",
    "AGUARDANDO AVERBACAO": "selo-espera",
    "NAO AVERBADO": "selo-falha",
};

const zeroAlerta = (valor) => (valor ? inteiro(valor) : '<span class="alerta-texto">0</span>');

const valorComQtd = (vlr, qtd, destaque = false) => blocoValor(vlr, qtd, undefined, destaque);

const colunaHierarquia = (chave, rotulo) => ({
    chave, rotulo, valor: (l) => l[chave] || "", classe: "texto-esquerda celula-hierarquia", hierarquia: true,
});

export const COLUNAS_LOJAS = [
    colunaHierarquia("gerencia", "Ger. Gestão"),
    colunaHierarquia("coordenacao", "Ger. Comercial III"),
    colunaHierarquia("supervisao", "Ger. Comercial"),
    { chave: "chave_loja", rotulo: "Chave", valor: (l) => l.chave_loja },
    {
        chave: "nome_loja", rotulo: "Loja", valor: (l) => l.nome_loja, classe: "texto-esquerda",
        html: (l) => `<strong>${l.nome_loja}</strong><small>${l.municipio || ""} - ${l.uf || ""}</small>`,
    },
    ...[
        { chave: "tentativas", rotulo: "Tentativas", valor: (l) => l.qtd_tentativas, html: (l) => zeroAlerta(l.qtd_tentativas) },
        { chave: "convertidas", rotulo: "Convertidas", valor: (l) => l.qtd_convertidas, html: (l) => inteiro(l.qtd_convertidas) },
        { chave: "conversao", rotulo: "Conversão", valor: (l) => l.pct_conversao, html: (l) => percentual(l.pct_conversao) },
        {
            chave: "averbado", rotulo: "Averbado", valor: (l) => l.vlr_averbado,
            html: (l) => valorComQtd(l.vlr_averbado, l.qtd_averbado, true),
        },
        {
            chave: "aguardando", rotulo: "Aguardando Averbação",
            rotuloHtml: "Aguardando<br>Averbação",
            valor: (l) => l.vlr_aguardando,
            html: (l) => valorComQtd(l.vlr_aguardando, l.qtd_aguardando),
        },
        {
            chave: "nao_averbado", rotulo: "Não Averbado", valor: (l) => l.vlr_nao_averbado,
            html: (l) => valorComQtd(l.vlr_nao_averbado, l.qtd_nao_averbado),
        },
    ].map((c) => ({ ...c, metrica: true })),
];

export const COLUNAS_CONTRATOS = [
    { chave: "dia", rotulo: "Data", valor: (c) => c.dia, html: (c) => dataCurta(c.dia), csv: (c) => dataCurta(c.dia) },
    { chave: "produto", rotulo: "Produto", valor: (c) => c.produto, html: (c) => NOMES_PRODUTO[c.produto] || c.produto },
    {
        chave: "situacao", rotulo: "Situação", valor: (c) => c.situacao,
        html: (c) => `<span class="selo ${CLASSE_SITUACAO[c.situacao] || ""}">${NOMES_SITUACAO[c.situacao] || c.situacao}</span>`,
    },
    { chave: "contrato", rotulo: "Contrato", valor: (c) => c.contrato },
    { chave: "nsu", rotulo: "NSU", valor: (c) => c.nsu },
    { chave: "cpf", rotulo: "CPF", valor: (c) => c.cpf },
    { chave: "valor", rotulo: "Valor", valor: (c) => c.valor, html: (c) => `<strong>${moedaCentavos(c.valor)}</strong>` },
];

export const COLUNAS_TENTATIVAS = [
    {
        chave: "dia", rotulo: "Data", valor: (t) => t.dia, csv: (t) => dataCurta(t.dia),
        html: (t) => `${dataCurta(t.dia)} <small>${diaSemana(t.dia)}</small>`,
    },
    { chave: "produto", rotulo: "Produto", valor: (t) => t.produto, html: (t) => NOMES_PRODUTO[t.produto] || t.produto },
    { chave: "tentativas", rotulo: "Tentativas", valor: (t) => t.tentativas, html: (t) => `<strong>${inteiro(t.tentativas)}</strong>` },
    { chave: "clientes", rotulo: "Clientes", valor: (t) => t.clientes, html: (t) => inteiro(t.clientes) },
    { chave: "convertidos", rotulo: "Convertidos", valor: (t) => t.convertidos, html: (t) => inteiro(t.convertidos) },
    {
        chave: "conversao", rotulo: "Conversão", valor: (t) => (t.tentativas ? t.convertidos / t.tentativas : 0),
        html: (t) => percentual(t.tentativas ? (100 * t.convertidos) / t.tentativas : 0),
        csv: (t) => (t.tentativas ? (100 * t.convertidos) / t.tentativas : 0),
    },
    { chave: "abandonadas", rotulo: "Abandonadas", valor: (t) => t.abandonadas, html: (t) => inteiro(t.abandonadas) },
    { chave: "erro_inelegibilidade", rotulo: "Erro inelegib.", valor: (t) => t.erro_inelegibilidade, html: (t) => inteiro(t.erro_inelegibilidade) },
    { chave: "outros_erros", rotulo: "Outros erros", valor: (t) => t.outros_erros, html: (t) => inteiro(t.outros_erros) },
];
