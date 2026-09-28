// Rotina diaria da equipe: mapa gerente x dia de tentativas/produtividade
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { estado, parametros } from "./estado.js";
import { compacto, dataCurta, diaMes, diaSemana, fimDeSemana, inteiro, moeda, percentual } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";
import { definirPeriodo } from "./periodo.js";
import { exportarRotina } from "./rotina-exportar.js";

const $ = (id) => document.getElementById(id);

const pctLojas = (c, l) => (l.qtd_lojas ? (100 * c.lojas) / l.qtd_lojas : 0);
const pctConv = (c) => (c.tent ? (100 * c.conv) / c.tent : 0);
const vlrPendente = (c) => c.vlr_ag + c.vlr_nao;

// cor: RGB base da escala de intensidade de cada metrica
const VERMELHO = "204, 9, 47";
const AMBAR = "196, 122, 0";

const METRICAS = {
    tentativas: {
        valor: (c) => c.tent, texto: (c) => inteiro(c.tent), situacao: "", cor: VERMELHO,
    },
    lojas: {
        valor: pctLojas, texto: (c, l) => `${Math.round(pctLojas(c, l))}%`, situacao: "", cor: VERMELHO,
    },
    conversao: {
        valor: pctConv, texto: (c) => (c.tent ? `${Math.round(pctConv(c))}%` : "0"), situacao: "", cor: VERMELHO,
    },
    producao: {
        valor: (c) => c.vlr, texto: (c) => (c.vlr ? compacto(c.vlr) : "0"),
        situacao: "AVERBADO", cor: VERMELHO, temProducao: (c) => c.vlr > 0,
    },
    pendente: {
        valor: vlrPendente, texto: (c) => (vlrPendente(c) ? compacto(vlrPendente(c)) : "0"),
        situacao: "PENDENTE", cor: AMBAR, temProducao: (c) => vlrPendente(c) > 0,
    },
};

const ROTULOS_PAIS = { gerencia: "Ger. Gest&atilde;o", coordenacao: "Ger. Comercial III" };

const EXTRATORES = {
    descricao: (l) => l.descricao,
    pai_gerencia: (l) => l.pai_gerencia || "",
    pai_coordenacao: (l) => l.pai_coordenacao || "",
    sem_tentativa: (l) => l.resumo.semTentativa,
    tentativas: (l) => l.resumo.tent,
    conversao: (l) => l.resumo.conversao,
    producao: (l) => l.resumo.vlr,
    pendente: (l) => l.resumo.pendente,
};

const opcoes = { metrica: "tentativas", nivel: "supervisao", janela: 15 };
let dados = null;
let ordem = null;

function inicioJanela() {
    if (!opcoes.janela) return estado.dataIni;
    const fim = new Date(`${estado.dataFim}T00:00:00`);
    fim.setDate(fim.getDate() - (opcoes.janela - 1));
    const inicio = fim.toISOString().slice(0, 10);
    return inicio > estado.dataIni ? inicio : estado.dataIni;
}

function calcularResumo(linha, dias) {
    const celulas = dias.map((d) => linha.dias[d]);
    const tent = celulas.reduce((t, c) => t + c.tent, 0);
    const conv = celulas.reduce((t, c) => t + c.conv, 0);
    linha.resumo = {
        tent,
        conversao: tent ? (100 * conv) / tent : 0,
        vlr: celulas.reduce((t, c) => t + c.vlr, 0),
        pendente: celulas.reduce((t, c) => t + vlrPendente(c), 0),
        semTentativa: dias.filter((d) => !fimDeSemana(d) && linha.dias[d].tent === 0).length,
    };
}

function renderizarCabecalho() {
    const pais = dados.pais.map((n) => `<th class="texto-esquerda" data-chave="pai_${n}">${ROTULOS_PAIS[n]}</th>`).join("");
    $("rotina-cabecalho").innerHTML = `<tr>
        ${pais}
        <th class="fixa" data-chave="descricao">${dados.rotulo}</th>
        <th data-chave="sem_tentativa" title="Dias uteis sem nenhuma tentativa">Dias &uacute;teis<br>sem tent.</th>
        <th data-chave="tentativas">Tentativas</th>
        <th data-chave="conversao">Conv.</th>
        <th data-chave="producao">Averbado</th>
        <th data-chave="pendente" title="Aguardando averba&ccedil;&atilde;o + n&atilde;o averbado">N&atilde;o<br>averbado</th>
        ${dados.dias.map((d) => `<th class="dia ${fimDeSemana(d) ? "fds" : ""}">${diaMes(d)}<small>${diaSemana(d)}</small></th>`).join("")}
    </tr>`;
}

function celula(linha, dia, metrica, maximo) {
    const c = linha.dias[dia];
    const fds = fimDeSemana(dia);
    const titulo = `${dataCurta(dia)} | ${inteiro(c.tent)} tentativas, ${inteiro(c.conv)} convertidas | ` +
        `${inteiro(c.lojas)}/${inteiro(linha.qtd_lojas)} lojas tentaram | ${moeda(c.vlr)} averbado | ` +
        `${moeda(c.vlr_ag)} aguardando averbação | ${moeda(c.vlr_nao)} não averbado`;

    if (c.tent === 0 && !metrica.temProducao?.(c)) {
        return `<td class="celula-dia clicavel ${fds ? "fds-vazio" : "zero-util"}" data-dia="${dia}" title="${titulo}">${fds ? "&middot;" : "0"}</td>`;
    }
    const razao = maximo ? metrica.valor(c, linha) / maximo : 0;
    const fundo = `rgba(${metrica.cor}, ${(0.08 + 0.82 * razao).toFixed(2)})`;
    const cor = razao > 0.5 ? "#FFFFFF" : "#2B2B2B";
    return `<td class="celula-dia clicavel" data-dia="${dia}" title="${titulo}" style="background:${fundo};color:${cor}">${metrica.texto(c, linha)}</td>`;
}

function linhasOrdenadas() {
    return ordem ? ordenar(dados.linhas, EXTRATORES[ordem.chave], ordem.crescente) : dados.linhas;
}

function exportar() {
    exportarRotina({
        botao: $("rotina-exportar"),
        dataIni: inicioJanela(),
        metrica: opcoes.metrica,
    });
}

function renderizarCorpo() {
    const metrica = METRICAS[opcoes.metrica];
    const linhas = linhasOrdenadas();

    if (!linhas.length) {
        $("rotina-corpo").innerHTML = '<tr><td class="vazio">Nenhum gerente encontrado.</td></tr>';
        return;
    }

    const maximo = Math.max(0, ...linhas.flatMap((l) => dados.dias.map((d) => metrica.valor(l.dias[d], l))));
    $("rotina-corpo").innerHTML = linhas.map((l) => {
        const pais = dados.pais.map((n) => `<td class="celula-pai">${l[`pai_${n}`] || "&ndash;"}</td>`).join("");
        return `<tr data-chave="${l.chave}" data-descricao="${l.descricao}">
            ${pais}
            <td class="fixa celula-nome clicavel"><strong>${l.descricao}</strong></td>
            <td class="${l.resumo.semTentativa ? "alerta-texto" : ""}"><strong>${inteiro(l.resumo.semTentativa)}</strong></td>
            <td>${inteiro(l.resumo.tent)}</td>
            <td>${percentual(l.resumo.conversao)}</td>
            <td>${compacto(l.resumo.vlr)}</td>
            <td class="valor-pendente">${compacto(l.resumo.pendente)}</td>
            ${dados.dias.map((d) => celula(l, d, metrica, maximo)).join("")}
        </tr>`;
    }).join("");
}

function aoClicar(evento) {
    const tr = evento.target.closest("tr[data-chave]");
    const td = evento.target.closest("td.clicavel");
    if (!tr || !td) return;

    const dia = td.dataset.dia;
    const metrica = METRICAS[opcoes.metrica];
    abrirDetalhe({
        titulo: `Detalhe · ${tr.dataset.descricao}${dia ? ` · ${dataCurta(dia)}` : ""}`,
        foco: metrica.situacao ? "" : "tentativas",
        filtros: {
            [dados.nivel]: tr.dataset.chave,
            data_ini: dia || inicioJanela(),
            data_fim: dia || estado.dataFim,
            situacao: metrica.situacao,
            incluir_sem_movimento: true,
        },
    });
}

export function rotinaCarregando() {
    $("rotina-corpo").innerHTML = '<tr><td class="carregando">Carregando...</td></tr>';
}

export async function carregarRotina() {
    dados = await buscar("/api/equipe-diaria", {
        ...parametros(),
        data_ini: inicioJanela(),
        nivel: opcoes.nivel,
    });
    dados.linhas.forEach((l) => calcularResumo(l, dados.dias));
    if (dados.dias.length) definirPeriodo("rotina", dados.dias[0], dados.dias[dados.dias.length - 1]);
    ordem = null;
    renderizarCabecalho();
    renderizarCorpo();
}

function recarregar() {
    rotinaCarregando();
    carregarRotina().catch((erro) => {
        $("rotina-corpo").innerHTML = `<tr><td class="vazio alerta-texto">${erro.message}</td></tr>`;
    });
}

export function iniciarRotina() {
    const botoes = document.querySelectorAll("#rotina-metricas .nivel-aba");
    botoes.forEach((botao) => botao.addEventListener("click", () => {
        botoes.forEach((b) => b.classList.toggle("ativa", b === botao));
        opcoes.metrica = botao.dataset.metrica;
        $("tabela-rotina").closest("section").classList.toggle("metrica-pendente", opcoes.metrica === "pendente");
        if (dados) renderizarCorpo();
    }));

    $("rotina-nivel").addEventListener("change", (e) => { opcoes.nivel = e.target.value; recarregar(); });
    $("rotina-janela").addEventListener("change", (e) => { opcoes.janela = Number(e.target.value); recarregar(); });
    $("rotina-corpo").addEventListener("click", aoClicar);
    $("rotina-exportar").addEventListener("click", exportar);

    configurarOrdenacao("tabela-rotina", (chave, crescente) => {
        ordem = { chave, crescente };
        renderizarCorpo();
    });
}
