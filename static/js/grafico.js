// Grafico diario: averbado, aguardando, nao averbado ou tentativas
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { parametros } from "./estado.js";
import { dataCurta, diaMes, diaSemana, inteiro, moedaCompacta } from "./formato.js";
import { rotulosPlugin } from "./grafico-rotulos.js";

const VERMELHO = "#CC092F";
const CINZA = "#BCBEC0";

const VISOES = {
    producao: {
        linha: { rotulo: "Produção averbada (R$)", dados: (d) => d.vlr_producao, formatar: moedaCompacta },
        barras: { rotulo: "Operações averbadas", dados: (d) => d.qtd_operacoes, formatar: inteiro },
        situacao: "AVERBADO",
    },
    aguardando: {
        linha: { rotulo: "Aguardando averbação (R$)", dados: (d) => d.vlr_aguardando, formatar: moedaCompacta },
        barras: { rotulo: "Operações aguardando", dados: (d) => d.qtd_aguardando, formatar: inteiro },
        situacao: "AGUARDANDO AVERBACAO",
    },
    nao_averbado: {
        linha: { rotulo: "Não averbado (R$)", dados: (d) => d.vlr_nao_averbado, formatar: moedaCompacta },
        barras: { rotulo: "Operações não averbadas", dados: (d) => d.qtd_nao_averbado, formatar: inteiro },
        situacao: "NAO AVERBADO",
    },
    tentativas: {
        linha: { rotulo: "Tentativas", dados: (d) => d.qtd_tentativas, formatar: inteiro },
        barras: { rotulo: "Convertidas", dados: (d) => d.qtd_convertidas, formatar: inteiro },
        situacao: "",
        eixoUnico: true,
    },
};

let grafico = null;
let dadosCache = null;
let visaoAtual = "producao";

function rotuloDia(iso) {
    return [diaMes(iso), diaSemana(iso)];
}

function tamanhoRotulo(chart) {
    const qtd = Math.max(chart.data.labels.length, 1);
    const slot = (chart.width - 110) / qtd;
    if (slot >= 34) return 11;
    if (slot >= 30) return 10;
    if (slot >= 26) return 9;
    return 8;
}

function ticksEixoX() {
    return {
        autoSkip: false,
        minRotation: 0,
        maxRotation: 0,
        padding: 2,
        font: (ctx) => ({ size: tamanhoRotulo(ctx.chart) }),
    };
}

function abrirDia(dia) {
    const tentativas = visaoAtual === "tentativas";
    abrirDetalhe({
        titulo: tentativas ? `Tentativas em ${dataCurta(dia)}` : `Lojas em ${dataCurta(dia)}`,
        foco: tentativas ? "tentativas" : "",
        filtros: { data_ini: dia, data_fim: dia, situacao: VISOES[visaoAtual].situacao },
    });
}

function configuracao(dados, visao) {
    return {
        data: {
            labels: dados.dias.map(rotuloDia),
            datasets: [
                {
                    type: "line",
                    label: visao.linha.rotulo,
                    data: visao.linha.dados(dados),
                    borderColor: VERMELHO,
                    backgroundColor: VERMELHO,
                    yAxisID: "eixoLinha",
                    tension: 0.3,
                    borderWidth: 2,
                    pointRadius: 3.5,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#FFFFFF",
                    pointBorderColor: VERMELHO,
                    pointBorderWidth: 2,
                    order: 0,
                },
                {
                    type: "bar",
                    label: visao.barras.rotulo,
                    data: visao.barras.dados(dados),
                    backgroundColor: CINZA,
                    hoverBackgroundColor: "#A7A9AC",
                    yAxisID: visao.eixoUnico ? "eixoLinha" : "eixoBarras",
                    order: 1,
                },
            ],
        },
        plugins: [rotulosPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            interaction: { mode: "index", intersect: false },
            onClick: (evento) => {
                const pontos = grafico.getElementsAtEventForMode(evento, "index", { intersect: false }, true);
                if (pontos.length) abrirDia(dados.dias[pontos[0].index]);
            },
            onHover: (evento, pontos) => {
                evento.native.target.style.cursor = pontos.length ? "pointer" : "default";
            },
            plugins: {
                rotulosLinha: { formatar: visao.linha.formatar },
                legend: { position: "bottom", labels: { usePointStyle: true, boxHeight: 6 } },
                tooltip: {
                    callbacks: {
                        title: (itens) => dataCurta(dados.dias[itens[0].dataIndex]),
                        label: (item) => {
                            const serie = item.datasetIndex === 0 ? visao.linha : visao.barras;
                            return ` ${serie.rotulo}: ${serie.formatar(item.raw)}`;
                        },
                        footer: () => "Clique para abrir por loja",
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: ticksEixoX() },
                eixoBarras: {
                    display: !visao.eixoUnico,
                    position: "left",
                    beginAtZero: true,
                    ticks: { callback: (v) => inteiro(v) },
                    grid: { color: "#EDEDED" },
                },
                eixoLinha: {
                    position: visao.eixoUnico ? "left" : "right",
                    beginAtZero: true,
                    grace: "12%",
                    ticks: { callback: (v) => visao.linha.formatar(v) },
                    grid: { display: Boolean(visao.eixoUnico), color: "#EDEDED" },
                },
            },
        },
    };
}

function desenhar() {
    if (grafico) grafico.destroy();
    const contexto = document.getElementById("grafico-diario");
    grafico = new Chart(contexto, configuracao(dadosCache, VISOES[visaoAtual]));
}

export function iniciarAlternadorGrafico() {
    const botoes = document.querySelectorAll("#grafico-visoes .nivel-aba");
    botoes.forEach((botao) => {
        botao.addEventListener("click", () => {
            botoes.forEach((b) => b.classList.toggle("ativa", b === botao));
            visaoAtual = botao.dataset.visao;
            if (dadosCache) desenhar();
        });
    });
}

export async function carregarGrafico() {
    dadosCache = await buscar("/api/serie-diaria", parametros());
    desenhar();
}
