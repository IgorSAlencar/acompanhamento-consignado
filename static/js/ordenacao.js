// Ordenacao de tabelas ao clicar no cabecalho
export function configurarOrdenacao(idTabela, aoOrdenar) {
    const cabecalho = document.getElementById(idTabela).querySelector("thead");

    cabecalho.addEventListener("click", (evento) => {
        const th = evento.target.closest("th[data-chave]");
        if (!th) return;

        const chave = th.dataset.chave;
        const crescente = th.dataset.direcao === "desc"; // alterna a direcao

        cabecalho.querySelectorAll("th[data-chave]").forEach((el) => {
            delete el.dataset.direcao;
        });
        th.dataset.direcao = crescente ? "asc" : "desc";

        aoOrdenar(chave, crescente);
    });
}

export function ordenar(linhas, extrator, crescente) {
    return [...linhas].sort((a, b) => {
        const va = extrator(a);
        const vb = extrator(b);
        const comparacao = typeof va === "string"
            ? va.localeCompare(vb, "pt-BR")
            : va - vb;
        return crescente ? comparacao : -comparacao;
    });
}
