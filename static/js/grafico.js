// Grafico diario com duas visoes: producao averbada ou tentativas
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { parametros } from "./estado.js";
import { dataCurta, diaMes, inteiro, moedaCompacta } from "./formato.js";
import { rotulosPlugin } from "./grafico-rotulos.js";

const VERMELHO = "#CC092F";
const CINZA = "#BCBEC0";

const VISOES = {
    producao: {
        linha: { rotulo: "Producao averbada (R$)", dados: (d) => d.vlr_producao, formatar: moedaCompacta },
        barras: { rotulo: "Operacoes averbadas", dados: (d) => d.qtd_operacoes, formatar: inteiro },
        situacao: "AVERBADO",
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

function abrirDia(dia) {
    abrirDetalhe({
        titulo: `Lojas em ${dataCurta(dia)}`,
        filtros: { data_ini: dia, data_fim: dia, situacao: VISOES[visaoAtual].situacao },
    });
}

function configuracao(dados, visao) {
    return {
        data: {
            labels: dados.dias.map(diaMes),
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
            maintainAspectRatio: true,
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
                x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } },
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
