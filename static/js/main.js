// Orquestracao do cockpit
import { iniciarDetalhe } from "./detalhe.js";
import { estado } from "./estado.js";
import { iniciarFiltros } from "./filtros.js";
import { carregarKpis, iniciarCliquesKpis, kpisCarregando } from "./kpis.js";
import { carregarGrafico, iniciarAlternadorGrafico } from "./grafico.js";
import { carregarTabela, iniciarOrdenacaoTabela, tabelaCarregando } from "./tabela.js";
import { carregarEquipe, equipeCarregando, iniciarControlesEquipe } from "./equipe.js";
import { carregarRotina, iniciarRotina, rotinaCarregando } from "./rotina.js";
import { carregarDu, iniciarDu } from "./du.js";
import { atualizarPeriodoGeral } from "./periodo.js";

const erroGlobal = () => document.getElementById("erro-global");

function mostrarErro(mensagem) {
    document.getElementById("erro-mensagem").textContent = mensagem;
    erroGlobal().classList.remove("oculto");
}

async function carregarTudo() {
    erroGlobal().classList.add("oculto");

    if (estado.modo === "du") {
        try {
            await carregarDu();
        } catch (erro) {
            mostrarErro(erro.message);
        }
        return;
    }

    atualizarPeriodoGeral();
    kpisCarregando();
    rotinaCarregando();

    const visaoGeral = !estado.produto;
    const tarefas = [carregarKpis(), carregarGrafico(), carregarRotina()];
    if (visaoGeral) {
        tabelaCarregando();
        equipeCarregando();
        tarefas.push(carregarTabela(), carregarEquipe(carregarTudo));
    }

    const resultados = await Promise.allSettled(tarefas);

    const falha = resultados.find((r) => r.status === "rejected");
    if (falha) mostrarErro(falha.reason.message);
}

function iniciarAbas() {
    const abas = document.querySelectorAll("#abas-produto .aba");
    abas.forEach((aba) => {
        aba.addEventListener("click", () => {
            abas.forEach((a) => a.classList.remove("ativa"));
            aba.classList.add("ativa");
            if (aba.dataset.modo === "du") {
                estado.modo = "du";
            } else {
                estado.modo = "geral";
                estado.produto = aba.dataset.produto;
            }
            document.body.classList.toggle("modo-du", estado.modo === "du");
            document.body.classList.toggle("modo-produto", estado.modo === "geral" && Boolean(estado.produto));
            carregarTudo();
        });
    });
}

function fixarAlturaTopo() {
    const topo = document.querySelector(".topo");
    if (!topo) return;
    const aplicar = () => {
        document.documentElement.style.setProperty("--topo-altura", `${topo.offsetHeight}px`);
    };
    aplicar();
    if (window.ResizeObserver) new ResizeObserver(aplicar).observe(topo);
}

async function iniciar() {
    fixarAlturaTopo();
    iniciarAbas();
    iniciarDetalhe();
    iniciarCliquesKpis();
    iniciarAlternadorGrafico();
    iniciarOrdenacaoTabela();
    iniciarControlesEquipe(carregarTudo);
    iniciarRotina();
    iniciarDu(carregarTudo);
    document.getElementById("btn-tentar-novamente")
        .addEventListener("click", carregarTudo);

    try {
        await iniciarFiltros(carregarTudo);
    } catch (erro) {
        mostrarErro(erro.message);
        return;
    }
    carregarTudo();
}

iniciar();
