// Plugin Chart.js: rotulos em "pilula" acima dos pontos da linha principal.
// Prioriza o ultimo dia e os maiores valores; rotulos que colidiriam sao omitidos.
const ALTURA = 18;
const ESPACO = 10;

function desenharPilula(ctx, x, y, largura, texto, xPonto) {
    const esquerda = x - largura / 2;
    const topo = y - ALTURA / 2;

    ctx.fillStyle = "#CC092F";
    ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.roundRect(esquerda, topo, largura, ALTURA, ALTURA / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";

    // Seta apontando para o ponto
    ctx.beginPath();
    ctx.moveTo(xPonto - 4, topo + ALTURA);
    ctx.lineTo(xPonto + 4, topo + ALTURA);
    ctx.lineTo(xPonto, topo + ALTURA + 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(texto, x, y + 0.5);
}

export const rotulosPlugin = {
    id: "rotulosLinha",
    afterDatasetsDraw(chart, _args, opcoes) {
        const meta = chart.getDatasetMeta(0);
        if (!meta || meta.hidden || !opcoes.formatar) return;

        const valores = chart.data.datasets[0].data;
        const { ctx } = chart;
        ctx.save();
        ctx.font = "600 10.5px 'Segoe UI', Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const ultimo = valores.length - 1;
        const ordem = valores
            .map((valor, indice) => ({ valor, indice }))
            .filter((p) => p.valor > 0)
            .sort((a, b) => (b.indice === ultimo) - (a.indice === ultimo) || b.valor - a.valor);

        const ocupados = [];
        ordem.forEach(({ valor, indice }) => {
            const ponto = meta.data[indice];
            const texto = opcoes.formatar(valor);
            const largura = ctx.measureText(texto).width + 12;
            const x = Math.min(Math.max(ponto.x, chart.chartArea.left + largura / 2), chart.chartArea.right - largura / 2);
            const y = ponto.y - 17;
            const inicio = x - largura / 2 - ESPACO;
            const fim = x + largura / 2 + ESPACO;

            const colide = ocupados.some((o) => inicio < o.fim && fim > o.inicio);
            if (colide) return;

            ocupados.push({ inicio, fim });
            desenharPilula(ctx, x, y, largura, texto, ponto.x);
        });
        ctx.restore();
    },
};
