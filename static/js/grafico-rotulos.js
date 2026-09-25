// Plugin Chart.js: rotulos em "pilula".
// Uma serie: ultimo dia e os maiores valores, sem sobrepor.
// Varias series: uma pilula por periodo, lado a lado, no dia util marcado.
const ALTURA = 18;
const ESPACO = 10;
const GAP_FILEIRA = 8;

function textoClaro(cor) {
    const hex = cor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 160;
}

function desenharPilula(ctx, x, y, largura, texto, xPonto, cor = "#CC092F", seta = true) {
    const esquerda = x - largura / 2;
    const topo = y - ALTURA / 2;

    ctx.fillStyle = cor;
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.roundRect(esquerda, topo, largura, ALTURA, ALTURA / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";

    if (seta) {
        ctx.beginPath();
        ctx.moveTo(xPonto - 4, topo + ALTURA);
        ctx.lineTo(xPonto + 4, topo + ALTURA);
        ctx.lineTo(xPonto, topo + ALTURA + 4);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = textoClaro(cor) ? "#FFFFFF" : "#2B2B2B";
    ctx.fillText(texto, x, y + 0.5);
}

function corLegivel(cor) {
    return textoClaro(cor) ? cor : "#5E6166";
}

function ultimoPositivo(valores) {
    for (let i = valores.length - 1; i >= 0; i -= 1) {
        if (valores[i] > 0) return i;
    }
    return -1;
}

function candidatosDaSerie(chart, indiceSerie) {
    const valores = chart.data.datasets[indiceSerie].data;
    const ultimo = ultimoPositivo(valores);
    return valores
        .map((valor, indice) => ({ valor, indice, indiceSerie, ultimo: indice === ultimo }))
        .filter((p) => p.valor > 0);
}

function medir(ctx, chart, indiceSerie, indice, formatar) {
    const valor = chart.data.datasets[indiceSerie].data[indice];
    const ponto = chart.getDatasetMeta(indiceSerie).data[indice];
    if (!(valor > 0) || !ponto) return null;

    const texto = formatar(valor);
    const largura = ctx.measureText(texto).width + 12;
    const x = Math.min(
        Math.max(ponto.x, chart.chartArea.left + largura / 2),
        chart.chartArea.right - largura / 2,
    );
    const y = ponto.y - 17;
    return {
        texto,
        largura,
        x,
        y,
        pontoX: ponto.x,
        caixa: {
            inicio: x - largura / 2 - ESPACO,
            fim: x + largura / 2 + ESPACO,
        },
    };
}

function cabe(caixa, ocupados) {
    return !ocupados.some((o) => caixa.inicio < o.fim && caixa.fim > o.inicio);
}

function desenharSerieUnica(chart, opcoes, indiceSerie) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = "600 10.5px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lista = candidatosDaSerie(chart, indiceSerie);
    lista.sort((a, b) => b.ultimo - a.ultimo || b.valor - a.valor);

    const ocupados = [];
    lista.forEach(({ indice }) => {
        const item = medir(ctx, chart, indiceSerie, indice, opcoes.formatar);
        if (!item || !cabe(item.caixa, ocupados)) return;
        ocupados.push(item.caixa);
        const cor = chart.data.datasets[indiceSerie].borderColor || "#CC092F";
        desenharPilula(ctx, item.x, item.y, item.largura, item.texto, item.pontoX, cor);
    });
    ctx.restore();
}

function indiceMarcado(chart, opcoes, series) {
    const pedido = opcoes.indice;
    const tamanho = chart.data.labels.length;
    if (Number.isInteger(pedido) && pedido >= 0 && pedido < tamanho) return pedido;
    const atual = series[series.length - 1];
    return ultimoPositivo(chart.data.datasets[atual].data);
}

// Uma fileira centrada no dia util da analise. Cada periodo entra uma vez.
function desenharFileira(chart, opcoes, series) {
    const { ctx } = chart;
    const indice = indiceMarcado(chart, opcoes, series);
    if (indice < 0) return;

    ctx.save();
    ctx.font = "600 10.5px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const itens = series.map((indiceSerie) => {
        const valor = chart.data.datasets[indiceSerie].data[indice];
        const ponto = chart.getDatasetMeta(indiceSerie).data[indice];
        if (!(valor > 0) || !ponto) return null;
        return {
            indiceSerie,
            ponto,
            texto: opcoes.formatar(valor),
            largura: ctx.measureText(opcoes.formatar(valor)).width + 12,
            cor: corLegivel(chart.data.datasets[indiceSerie].borderColor || "#CC092F"),
        };
    }).filter(Boolean);
    if (!itens.length) {
        ctx.restore();
        return;
    }

    const faixa = itens.reduce((soma, item) => soma + item.largura, 0) + GAP_FILEIRA * (itens.length - 1);
    const ancora = itens[itens.length - 1].ponto.x;
    let cursor = ancora - faixa / 2;
    const margem = chart.chartArea.left + 4;
    const limite = chart.chartArea.right - 4;
    if (cursor < margem) cursor = margem;
    if (cursor + faixa > limite) cursor = Math.max(margem, limite - faixa);

    const y = chart.chartArea.top - 22;
    itens.forEach((item) => {
        item.x = cursor + item.largura / 2;
        cursor += item.largura + GAP_FILEIRA;
    });

    itens.forEach((item) => {
        ctx.save();
        ctx.strokeStyle = item.cor;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(item.x, y + ALTURA / 2);
        ctx.lineTo(item.ponto.x, item.ponto.y);
        ctx.stroke();
        ctx.restore();
    });
    itens.forEach((item) => {
        desenharPilula(ctx, item.x, y, item.largura, item.texto, item.ponto.x, item.cor, false);
    });
    ctx.restore();
}

export const rotulosPlugin = {
    id: "rotulosLinha",
    afterDatasetsDraw(chart, _args, opcoes) {
        if (!opcoes.formatar) return;

        if (opcoes.todas) {
            const series = chart.data.datasets.map((_, i) => i)
                .filter((i) => !chart.getDatasetMeta(i).hidden);
            desenharFileira(chart, opcoes, series);
            return;
        }

        const indiceSerie = opcoes.datasetIndex ?? 0;
        if (chart.getDatasetMeta(indiceSerie).hidden) return;
        desenharSerieUnica(chart, opcoes, indiceSerie);
    },
};
