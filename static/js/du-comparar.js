// Escolha livre dos meses de comparacao da aba Dia Util.
// O mes atual entra sempre; o usuario marca um ou mais meses anteriores.
import { estado } from "./estado.js";
import { mesAno } from "./formato.js";

const JANELA = 12;

export function mesesAntes(mesRef, qtd) {
    const lista = [];
    let ano = Math.floor(mesRef / 100);
    let mes = mesRef % 100;
    for (let i = 0; i < qtd; i += 1) {
        mes -= 1;
        if (mes < 1) {
            mes = 12;
            ano -= 1;
        }
        lista.push(ano * 100 + mes);
    }
    return lista;
}

function rotuloBotao(meses) {
    const nomes = [...meses].sort((a, b) => a - b).map(mesAno);
    if (nomes.length === 1) return nomes[0];
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
    return `${nomes.length} meses`;
}

function mesmaLista(a, b) {
    const esquerda = [...a].sort((x, y) => x - y);
    const direita = [...b].sort((x, y) => x - y);
    return esquerda.length === direita.length && esquerda.every((mes, i) => mes === direita[i]);
}

function marcarAtalhos(mesRef, selecionados) {
    document.querySelectorAll("#du-comparar-painel [data-anteriores]").forEach((botao) => {
        const esperado = mesesAntes(mesRef, Number(botao.dataset.anteriores));
        botao.classList.toggle("ativa", mesmaLista(esperado, selecionados));
    });
}

export function sincronizarComparar(mesRef, mesesUsados, disponiveis) {
    const anteriores = (mesesUsados || []).filter((mes) => mes !== mesRef);
    estado.du.comparar = anteriores;
    const painel = document.getElementById("du-comparar-painel");
    painel.dataset.mesRef = String(mesRef);
    const ativos = new Set(anteriores);
    const lista = (disponiveis && disponiveis.length ? disponiveis : mesesAntes(mesRef, JANELA));
    document.getElementById("du-comparar-meses").innerHTML = lista.map((mes) => `
        <label class="du-comparar-mes">
            <input type="checkbox" value="${mes}" ${ativos.has(mes) ? "checked" : ""}>
            ${mesAno(mes)}
        </label>`).join("");
    document.getElementById("du-comparar-botao").textContent = rotuloBotao(anteriores);
    marcarAtalhos(mesRef, anteriores);
}

export function iniciarComparar(recarregar) {
    const botao = document.getElementById("du-comparar-botao");
    const painel = document.getElementById("du-comparar-painel");

    botao.addEventListener("click", () => {
        const aberto = painel.classList.toggle("oculto");
        botao.setAttribute("aria-expanded", String(!aberto));
    });

    document.addEventListener("click", (evento) => {
        if (evento.target.closest(".du-comparar")) return;
        painel.classList.add("oculto");
        botao.setAttribute("aria-expanded", "false");
    });

    painel.addEventListener("click", (evento) => {
        const atalho = evento.target.closest("[data-anteriores]");
        if (!atalho) return;
        const mesRef = Number(painel.dataset.mesRef);
        estado.du.comparar = mesesAntes(mesRef, Number(atalho.dataset.anteriores));
        estado.du.du = "";
        painel.classList.add("oculto");
        botao.setAttribute("aria-expanded", "false");
        recarregar();
    });

    painel.addEventListener("change", (evento) => {
        if (evento.target.type !== "checkbox") return;
        const marcados = [...painel.querySelectorAll("input:checked")].map((el) => Number(el.value));
        if (!marcados.length) {
            evento.target.checked = true;
            return;
        }
        estado.du.comparar = marcados.sort((a, b) => a - b);
        estado.du.du = "";
        recarregar();
    });
}
