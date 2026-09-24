// Orquestracao do cockpit
import { iniciarDetalhe } from "./detalhe.js";
import { estado } from "./estado.js";
import { iniciarFiltros } from "./filtros.js";
import { carregarKpis, iniciarCliquesKpis, kpisCarregando } from "./kpis.js";
import { carregarGrafico, iniciarAlternadorGrafico } from "./grafico.js";
import { carregarTabela, iniciarOrdenacaoTabela, tabelaCarregando } from "./tabela.js";
import { carregarEquipe, equipeCarregando, iniciarControlesEquipe } from "./equipe.js";
import { carregarRotina, iniciarRotina, rotinaCarregando } from "./rotina.js";
import { atualizarPeriodoGeral } from "./periodo.js";

const erroGlobal = () => document.getElementById("erro-global");

function mostrarErro(mensagem) {
    document.getElementById("erro-mensagem").textContent = mensagem;
    erroGlobal().classList.remove("oculto");
}

async function carregarTudo() {
    erroGlobal().classList.add("oculto");
    atualizarPeriodoGeral();
    kpisCarregando();
    tabelaCarregando();
    equipeCarregando();
    rotinaCarregando();

    const resultados = await Promise.allSettled([
        carregarKpis(),
        carregarGrafico(),
        carregarTabela(),
        carregarEquipe(carregarTudo),
        carregarRotina(),
    ]);

    const falha = resultados.find((r) => r.status === "rejected");
    if (falha) mostrarErro(falha.reason.message);
}

function iniciarAbas() {
    const abas = document.querySelectorAll("#abas-produto .aba");
    abas.forEach((aba) => {
        aba.addEventListener("click", () => {
            abas.forEach((a) => a.classList.remove("ativa"));
            aba.classList.add("ativa");
            estado.produto = aba.dataset.produto;
            carregarTudo();
        });
    });
}

async function iniciar() {
    iniciarAbas();
    iniciarDetalhe();
    iniciarCliquesKpis();
    iniciarAlternadorGrafico();
    iniciarOrdenacaoTabela();
    iniciarControlesEquipe(carregarTudo);
    iniciarRotina();
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
