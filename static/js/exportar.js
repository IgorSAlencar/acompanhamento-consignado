// Exportacao de tabelas para CSV (abre direto no Excel pt-BR)
function celula(valor) {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "number") return String(valor).replace(".", ",");
    const texto = String(valor);
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function exportarCsv(nomeArquivo, colunas, linhas) {
    const cabecalho = colunas.map((c) => celula(c.rotulo)).join(";");
    const corpo = linhas.map((l) => colunas.map((c) => celula((c.csv || c.valor)(l))).join(";"));
    const conteudo = "\uFEFF" + [cabecalho, ...corpo].join("\r\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(link.href);
}
