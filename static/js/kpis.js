// Cartoes de KPI do topo (numeros cheios; producao = apenas contratos averbados)
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { parametros } from "./estado.js";
import { inteiro, moeda, percentual } from "./formato.js";

const IDS = [
    "kpi-producao", "kpi-operacoes",
    "kpi-aguardando-vlr", "kpi-aguardando-qtd",
    "kpi-nao-averbado-vlr", "kpi-nao-averbado-qtd",
    "kpi-tentativas", "kpi-convertidas", "kpi-conversao", "kpi-cobertura", "kpi-lojas",
];

function definir(id, texto) {
    document.getElementById(id).textContent = texto;
}

export function iniciarCliquesKpis() {
    document.querySelectorAll("#cartoes-kpi [data-detalhe]").forEach((cartao) => {
        cartao.addEventListener("click", () => {
            abrirDetalhe({
                titulo: `Detalhe · ${cartao.dataset.detalhe}`,
                filtros: {
                    situacao: cartao.dataset.situacao || "",
                    incluir_sem_movimento: cartao.dataset.semMovimento === "1",
                },
            });
        });
    });
}

export function kpisCarregando() {
    IDS.forEach((id) => document.getElementById(id).classList.add("skeleton"));
}

export async function carregarKpis() {
    const dados = await buscar("/api/resumo", parametros());

    definir("kpi-producao", moeda(dados.vlr_averbado));
    definir("kpi-operacoes", `${inteiro(dados.qtd_averbado)} operações averbadas`);
    definir("kpi-aguardando-vlr", moeda(dados.vlr_aguardando));
    definir("kpi-aguardando-qtd", `${inteiro(dados.qtd_aguardando)} operações`);
    definir("kpi-nao-averbado-vlr", moeda(dados.vlr_nao_averbado));
    definir("kpi-nao-averbado-qtd", `${inteiro(dados.qtd_nao_averbado)} operações`);
    definir("kpi-tentativas", inteiro(dados.qtd_tentativas));
    definir("kpi-convertidas", `${inteiro(dados.qtd_convertidas)} convertidas`);
    definir("kpi-conversao", `${percentual(dados.pct_conversao)} convers\u00e3o`);
    definir("kpi-cobertura", percentual(dados.pct_cobertura));
    definir("kpi-lojas", `${inteiro(dados.qtd_lojas_producao)}/${inteiro(dados.qtd_lojas)} lojas ativas com produção averbada`);

    IDS.forEach((id) => document.getElementById(id).classList.remove("skeleton"));
}
