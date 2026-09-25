// Filtros em cascata: Ger. Gestao > Ger. Comercial III > Ger. Comercial
import { buscar } from "./api.js";
import { estado, nivelDerivado, nivelDerivadoDu } from "./estado.js";

let opcoes = { gerencias: [], coordenacoes: [], supervisoes: [] };

const selGerencia = () => document.getElementById("filtro-gerencia");
const selCoordenacao = () => document.getElementById("filtro-coordenacao");
const selSupervisao = () => document.getElementById("filtro-supervisao");

function preencher(select, itens, rotuloTodos) {
    select.innerHTML = `<option value="">${rotuloTodos}</option>`;
    itens.forEach((item) => {
        const opcao = document.createElement("option");
        opcao.value = item.chave;
        opcao.textContent = item.descricao;
        select.appendChild(opcao);
    });
}

function atualizarCascata() {
    const coordenacoes = estado.gerencia
        ? opcoes.coordenacoes.filter((c) => String(c.gerencia) === estado.gerencia)
        : opcoes.coordenacoes;
    preencher(selCoordenacao(), coordenacoes, "Todas");
    selCoordenacao().value = estado.coordenacao;

    const chavesCoord = new Set(coordenacoes.map((c) => String(c.chave)));
    const supervisoes = estado.coordenacao
        ? opcoes.supervisoes.filter((s) => String(s.coordenacao) === estado.coordenacao)
        : opcoes.supervisoes.filter((s) => chavesCoord.has(String(s.coordenacao)));
    preencher(selSupervisao(), supervisoes, "Todas");
    selSupervisao().value = estado.supervisao;
}

export function descricaoDe(nivel, chave) {
    const lista = { gerencia: "gerencias", coordenacao: "coordenacoes", supervisao: "supervisoes" }[nivel];
    const item = opcoes[lista].find((i) => String(i.chave) === String(chave));
    return item ? item.descricao : chave;
}

export async function iniciarFiltros(aoMudar) {
    opcoes = await buscar("/api/filtros");
    preencher(selGerencia(), opcoes.gerencias, "Todas");
    atualizarCascata();

    // Ao alterar um nivel superior, os inferiores sao limpos
    selGerencia().addEventListener("change", (ev) => {
        estado.gerencia = ev.target.value;
        estado.coordenacao = "";
        estado.supervisao = "";
        estado.nivelEquipe = nivelDerivado();
        estado.du.nivel = nivelDerivadoDu();
        atualizarCascata();
        aoMudar();
    });

    selCoordenacao().addEventListener("change", (ev) => {
        estado.coordenacao = ev.target.value;
        estado.supervisao = "";
        estado.nivelEquipe = nivelDerivado();
        estado.du.nivel = nivelDerivadoDu();
        atualizarCascata();
        aoMudar();
    });

    selSupervisao().addEventListener("change", (ev) => {
        estado.supervisao = ev.target.value;
        estado.nivelEquipe = nivelDerivado();
        estado.du.nivel = nivelDerivadoDu();
        aoMudar();
    });

    const dataIni = document.getElementById("filtro-data-ini");
    const dataFim = document.getElementById("filtro-data-fim");
    dataIni.value = estado.dataIni;
    dataFim.value = estado.dataFim;
    dataIni.addEventListener("change", (ev) => { estado.dataIni = ev.target.value; aoMudar(); });
    dataFim.addEventListener("change", (ev) => { estado.dataFim = ev.target.value; aoMudar(); });
}

// Usado pelo drill-down da Equipe para selecionar um nivel via codigo
export function selecionar(nivel, chave) {
    if (nivel === "gerencia") {
        estado.gerencia = String(chave);
        estado.coordenacao = "";
        estado.supervisao = "";
        selGerencia().value = estado.gerencia;
    } else if (nivel === "coordenacao") {
        estado.coordenacao = String(chave);
        estado.supervisao = "";
    } else {
        estado.supervisao = String(chave);
    }
    atualizarCascata();
}
