// Grafico da aba Dia Util: uma linha por mes comparado, eixo X = DU 1..N
import { inteiro, mesAno, moedaCompacta } from "./formato.js";
import { rotulosPlugin } from "./grafico-rotulos.js";

const VERMELHO = "#CC092F";

export const FORMATOS_METRICA = {
    vlr: moedaCompacta,
    qtd: inteiro,
    lojas: inteiro,
    tentativas: inteiro,
};

export const NOMES_METRICA = {
    vlr: "Valor averbado",
    qtd: "Operações averbadas",
    lojas: "Lojas produtivas",
    tentativas: "Tentativas",
};

const graficos = {}; // canvasId -> instancia do Chart (grafico principal e da loja)

// Linha vertical tracejada marcando o DU "ate" da analise
const marcaDuPlugin = {
    id: "marcaDu",
    afterDatasetsDraw(chart, _args, opcoes) {
        const { indice } = opcoes;
        if (indice == null || indice < 0) return;
        const x = chart.scales.x.getPixelForValue(indice);
        const { top, bottom } = chart.chartArea;
        if (x < chart.chartArea.left || x > chart.chartArea.right) return;
        const { ctx } = chart;
        ctx.save();
        ctx.strokeStyle = "#808285";
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#808285";
        ctx.font = "600 11px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`DU ${indice + 1}`, x, top - 6);
        ctx.restore();
    },
};

// Mes de referencia em vermelho forte; M-1 cinza escuro; demais cinza tracejado
function estiloLinha(posicao, total) {
    if (posicao === total - 1) {
        return {
            borderColor: VERMELHO,
            backgroundColor: VERMELHO,
            borderWidth: 3,
            pointRadius: 3,
            pointBackgroundColor: "#FFFFFF",
            pointBorderColor: VERMELHO,
            pointBorderWidth: 2,
        };
    }
    if (posicao === total - 2) {
        return { borderColor: "#808285", backgroundColor: "#808285", borderWidth: 2, pointRadius: 2 };
    }
    return {
        borderColor: "#BCBEC0",
        backgroundColor: "#BCBEC0",
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
    };
}

export function desenharCurvas(canvasId, curva, { metrica, visao, aoClicarDu }) {
    const formatar = FORMATOS_METRICA[metrica];
    const labels = Array.from({ length: curva.max_du }, (_, i) => `DU ${i + 1}`);
    const datasets = curva.meses.map((mes, i) => {
        const serie = curva.series[mes][metrica][visao];
        return {
            type: "line",
            label: mesAno(mes),
            data: labels.map((_, du) => (du < serie.length ? serie[du] : null)),
            tension: 0.25,
            spanGaps: false,
            order: curva.meses.length - i, // mes de referencia por cima
            ...estiloLinha(i, curva.meses.length),
        };
    });

    if (graficos[canvasId]) graficos[canvasId].destroy();
    graficos[canvasId] = new Chart(document.getElementById(canvasId), {
        data: { labels, datasets },
        plugins: [rotulosPlugin, marcaDuPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            interaction: { mode: "index", intersect: false },
            onClick: aoClicarDu
                ? (evento) => {
                    const pontos = graficos[canvasId]
                        .getElementsAtEventForMode(evento, "index", { intersect: false }, true);
                    if (pontos.length) aoClicarDu(pontos[0].index + 1);
                }
                : undefined,
            onHover: aoClicarDu
                ? (evento, pontos) => {
                    evento.native.target.style.cursor = pontos.length ? "pointer" : "default";
                }
                : undefined,
            plugins: {
                rotulosLinha: { formatar, datasetIndex: datasets.length - 1 },
                marcaDu: { indice: curva.du_atual - 1 },
                legend: { position: "bottom", labels: { usePointStyle: true, boxHeight: 6 } },
                tooltip: {
                    callbacks: {
                        title: (itens) => `Dia útil ${itens[0].dataIndex + 1}`,
                        label: (item) => ` ${item.dataset.label}: ${formatar(item.raw ?? 0)}`,
                        footer: aoClicarDu ? () => "Clique para fixar este DU" : undefined,
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 24 } },
                y: {
                    beginAtZero: true,
                    grace: "10%",
                    ticks: { callback: (v) => formatar(v) },
                    grid: { color: "#EDEDED" },
                },
            },
        },
    });
}
