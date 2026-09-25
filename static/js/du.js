// Orquestra a aba Dia Util: controles, curva comparativa, cards de ritmo e ranking
import { buscar } from "./api.js";
import { NOMES_METRICA, desenharCurvas } from "./du-grafico.js";
import { atualizarCartoesDu, cartoesDuCarregando } from "./du-kpis.js";
import {
    carregarRanking, fecharCurvaLoja, iniciarRanking, rankingCarregando,
    rankingErro, redesenharCurvaLoja,
} from "./du-ranking.js";
import { iniciarComparar, sincronizarComparar } from "./du-comparar.js";
import { estado, parametrosDu } from "./estado.js";
import { mesAno } from "./formato.js";

let curva = null;
let recarregar = null; // carregarTudo do main.js (trata erro global)

function redesenharCurva() {
    if (!curva) return;
    document.getElementById("du-grafico-titulo").textContent =
        `${NOMES_METRICA[estado.du.metrica]} · ${estado.du.visao === "acum" ? "acumulado" : "dia a dia"} por dia útil`;
    desenharCurvas("du-grafico", curva, {
        metrica: estado.du.metrica,
        visao: estado.du.visao,
        aoClicarDu: (du) => {
            estado.du.du = du;
            recarregar();
        },
    });
}

function atualizarSeloMeses() {
    document.getElementById("du-selo-meses").textContent = curva.meses.map(mesAno).join(" · ");
}

function atualizarSeletorDu() {
    const select = document.getElementById("du-limite");
    const total = Number(curva.total_dus[curva.mes_ref]) || curva.max_du;
    const limite = Math.min(total, curva.du_hoje || total);
    select.innerHTML = "";
    for (let i = 1; i <= limite; i += 1) {
        const opcao = document.createElement("option");
        opcao.value = i;
        opcao.textContent = `DU ${i}${i === curva.du_hoje ? " (D-1)" : ""}`;
        select.appendChild(opcao);
    }
    select.value = String(curva.du_atual);
}

// Recarrega so o ranking (troca de metrica/nivel nao muda a curva)
async function recarregarRanking() {
    rankingCarregando();
    try {
        await carregarRanking();
    } catch (erro) {
        rankingErro(erro.message);
    }
}

export async function carregarDu() {
    cartoesDuCarregando();
    rankingCarregando();
    fecharCurvaLoja();
    const [dadosCurva] = await Promise.all([
        buscar("/api/du/curva", parametrosDu()),
        carregarRanking().catch((erro) => rankingErro(erro.message)),
    ]);
    curva = dadosCurva;
    estado.du.du = curva.du_atual;
    atualizarSeletorDu();
    atualizarSeloMeses();
    sincronizarComparar(curva.mes_ref, curva.meses, curva.meses_disponiveis);
    redesenharCurva();
    atualizarCartoesDu(curva, estado.du.metrica);
}

function grupoAbas(id, atributo, aoEscolher) {
    const botoes = document.querySelectorAll(`#${id} .nivel-aba`);
    botoes.forEach((botao) => {
        botao.addEventListener("click", () => {
            botoes.forEach((b) => b.classList.toggle("ativa", b === botao));
            aoEscolher(botao.dataset[atributo]);
        });
    });
}

export function iniciarDu(recarregarTudo) {
    recarregar = recarregarTudo;
    iniciarRanking({ aoNavegar: recarregarTudo, aoTrocarNivel: recarregarRanking });

    grupoAbas("du-produtos", "produto", (valor) => {
        estado.du.produto = valor;
        recarregar();
    });

    grupoAbas("du-metricas", "metrica", (valor) => {
        estado.du.metrica = valor;
        if (!curva) return;
        redesenharCurva();
        redesenharCurvaLoja();
        atualizarCartoesDu(curva, valor);
        recarregarRanking();
    });

    grupoAbas("du-visoes", "visao", (valor) => {
        estado.du.visao = valor;
        redesenharCurva();
        redesenharCurvaLoja();
    });

    iniciarComparar(recarregar);

    document.getElementById("du-limite").addEventListener("change", (evento) => {
        estado.du.du = Number(evento.target.value);
        recarregar();
    });
}
