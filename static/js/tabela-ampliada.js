// Move a secao original para o dialogo: preserva dados, controles e listeners.
import { redimensionarGrafico } from "./grafico.js";

let atual = null;
let dialogo;
let conteudo;

function ajustar() {
    if (!atual) return;
    const titulo = atual.escopo.querySelector(".secao-titulo, .modal-titulo");
    if (titulo) document.getElementById("tabela-ampliada-titulo").textContent = titulo.textContent.trim();
    if (atual.tabela) {
        const primeiraLinha = atual.tabela.tHead?.rows[0];
        atual.tabela.style.setProperty("--cabecalho-altura", `${primeiraLinha?.getBoundingClientRect().height || 38}px`);
    }
    atual.redimensionar?.();
}

function fechar() {
    if (dialogo.open) dialogo.close();
}

function restaurar() {
    if (!atual) return;
    const { escopo, marcador, tabela, painel, botao, scrollTop, scrollLeft, observer, resize, cabecalhoItens, redimensionar } = atual;
    observer.disconnect();
    resize.disconnect();
    cabecalhoItens.forEach(({ elemento, lugar }) => lugar.replaceWith(elemento));
    marcador.replaceWith(escopo);
    escopo.classList.remove("escopo-ampliado");
    tabela?.style.removeProperty("--cabecalho-altura");
    painel.scrollTop = scrollTop;
    painel.scrollLeft = scrollLeft;
    document.body.classList.remove("tabela-ampliada-aberta");
    dialogo.classList.remove("ampliacao-grafico");
    dialogo.style.removeProperty("--grafico-altura");
    atual = null;
    redimensionar?.();
    botao.focus({ preventScroll: true });
}

function abrir(alvo, botao) {
    if (atual) return;
    const grafico = alvo.tagName === "CANVAS";
    const tabela = grafico ? null : alvo;
    const painel = alvo.closest(grafico ? ".painel" : ".painel-tabela");
    const escopo = alvo.closest(".modal-caixa, .du-ranking, section");
    dialogo.classList.toggle("ampliacao-grafico", grafico);
    if (grafico) dialogo.style.setProperty("--grafico-altura", `${alvo.parentElement.clientHeight}px`);
    const marcador = document.createComment("local da tabela ampliada");
    const titulo = escopo.querySelector(".secao-titulo, .modal-titulo")?.textContent.trim()
        || "Ranking por dia útil";
    atual = {
        tabela, painel, escopo, marcador, botao,
        redimensionar: grafico ? redimensionarGrafico : null,
        scrollTop: painel.scrollTop, scrollLeft: painel.scrollLeft,
        observer: new MutationObserver(ajustar), resize: new ResizeObserver(ajustar),
        cabecalhoItens: [],
    };
    const contexto = document.getElementById("tabela-ampliada-contexto");
    escopo.querySelectorAll(".modal-topo .migalhas, .modal-topo .chips").forEach((elemento) => {
        const lugar = document.createComment("local do contexto do detalhe");
        elemento.before(lugar);
        contexto.append(elemento);
        atual.cabecalhoItens.push({ elemento, lugar });
    });
    escopo.before(marcador);
    conteudo.append(escopo);
    escopo.classList.add("escopo-ampliado");
    document.getElementById("tabela-ampliada-titulo").textContent = titulo;
    document.body.classList.add("tabela-ampliada-aberta");
    dialogo.showModal();
    painel.scrollLeft = 0;
    ajustar();
    atual.observer.observe(escopo, { childList: true, subtree: true, characterData: true });
    atual.resize.observe(painel);
}

export function iniciarAmpliacaoTabelas() {
    dialogo = document.getElementById("tabela-ampliada");
    conteudo = document.getElementById("tabela-ampliada-conteudo");
    document.getElementById("tabela-ampliada-fechar").addEventListener("click", fechar);
    dialogo.addEventListener("close", restaurar);
    // Escape fecha somente a ampliacao; o detalhe pode continuar aberto abaixo.
    dialogo.addEventListener("keydown", (e) => { if (e.key === "Escape") e.stopPropagation(); });
    dialogo.addEventListener("click", (e) => {
        if (e.target !== dialogo) return;
        const r = dialogo.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fechar();
    });
    document.addEventListener("detalhe:abrir", () => {
        if (atual && atual.tabela?.id !== "detalhe-tabela") {
            fechar();
            restaurar();
        }
    });
    document.addEventListener("detalhe:fechar", () => {
        if (atual?.tabela?.id === "detalhe-tabela") { fechar(); restaurar(); }
    });
    document.querySelectorAll(".painel-tabela > table, #grafico-diario").forEach((alvo) => {
        const grafico = alvo.tagName === "CANVAS";
        if (!grafico) alvo.parentElement.tabIndex = 0;
        const escopo = alvo.closest(".modal-caixa, .du-ranking, section");
        const titulo = escopo.querySelector(".secao-titulo, .modal-titulo");
        const cabecalho = document.createElement("div");
        cabecalho.className = "secao-cabecalho";
        titulo.before(cabecalho);
        cabecalho.append(titulo);
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "btn-ampliar-tabela";
        botao.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg><span>Ampliar</span>';
        botao.setAttribute("aria-label", grafico ? "Ampliar gráfico" : "Ampliar tabela");
        botao.title = grafico ? "Ampliar gráfico" : "Ampliar tabela";
        botao.dataset.ampliarAlvo = alvo.id;
        botao.setAttribute("aria-haspopup", "dialog");
        botao.setAttribute("aria-controls", "tabela-ampliada");
        botao.addEventListener("click", () => abrir(alvo, botao));
        cabecalho.append(botao);
    });
}
