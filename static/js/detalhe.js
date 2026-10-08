// Painel de detalhe: qualquer numero -> resumo por nivel hierarquico -> lojas -> contratos / tentativas
import { buscar } from "./api.js";
import {
    NIVEIS, agrupar, colunasGrupo, colunasLojas, filtrarPorTrilha, indiceNivel, nivelInicial, temMovimento,
} from "./detalhe-agrupar.js";
import { COLUNAS_CONTRATOS, COLUNAS_TENTATIVAS, htmlCabecalho } from "./detalhe-colunas.js";
import { atualizarChips, atualizarMigalhas } from "./detalhe-contexto.js";
import { colunasContratosPeriodo, barraContratos, filtrarSituacaoContratos, paginaContratos, reiniciarPaginaContratos } from "./detalhe-contratos.js";
import { parametros } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";
import { htmlLinhaTotal } from "./detalhe-total.js";
import { inteiro } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";
import { linhaCarregandoTabela } from "./tabela-carregamento.js";

const $ = (id) => document.getElementById(id);
let contexto = null;      // { titulo, filtros, foco }
let lojasBase = [];       // movimento; ativas sem movimento carregadas sob demanda
let baseIncluiSemMovimento = false;
let requisicao = 0;
let trilha = [];          // passos de drill-down: [{ nivel, valor }]
let agrupamento = "gerencia";
let visao = null;         // { tipo, colunas, linhas }
let loja = null;
let dadosLoja = null;
let ordem = null;
let busca = "";
let incluirSemMovimento = false;

function comMovimento(l) {
    return temMovimento(l, contexto?.foco, contexto?.filtros.situacao);
}

function porProduto() {
    return contexto?.foco === "tentativas" && !contexto.filtros.produto;
}

function linhasVisiveis() {
    let linhas = visao.linhas;
    if (contexto.contratosDireto) linhas = filtrarSituacaoContratos(linhas, contexto.filtros.situacao);
    if (busca) {
        const termo = busca.trim().toLowerCase();
        linhas = linhas.filter((l) => Object.values(l).some((v) => String(v).toLowerCase().includes(termo)));
    }
    if (ordem) {
        const coluna = visao.colunas.find((c) => c.chave === ordem.chave);
        linhas = ordenar(linhas, coluna.valor, ordem.crescente);
    }
    return linhas;
}

function chipsContexto() {
    atualizarChips(contexto);
}

function migalhas() {
    atualizarMigalhas(trilha, loja, irParaTrilha, contexto.contratosDireto);
}

function renderizarCabecalho() {
    $("detalhe-cabecalho").innerHTML = htmlCabecalho(visao.colunas);
}

function renderizarTabela() {
    const linhas = linhasVisiveis();
    const pagina = contexto.contratosDireto ? paginaContratos(linhas) : linhas;
    $("detalhe-rodape").innerHTML = htmlLinhaTotal(visao, linhas, agrupamento);
    const corpo = $("detalhe-corpo");
    if (!linhas.length) {
        corpo.innerHTML = `<tr><td colspan="${visao.colunas.length}" class="vazio">Nenhum registro encontrado.</td></tr>`;
        return;
    }
    const clicavel = visao.tipo === "grupos" || visao.tipo === "lojas";
    corpo.innerHTML = pagina.map((l, i) => `
        <tr class="${clicavel ? "linha-clicavel" : ""}" data-indice="${i}">
            ${visao.colunas.map((c) => `<td class="${c.classe || ""} celula-produto">${c.html ? c.html(l) : l[c.chave] ?? ""}</td>`).join("")}
        </tr>`).join("");
    corpo._linhas = pagina;
}

function abasAgrupamento() {
    const minimo = trilha.length
        ? indiceNivel(trilha[trilha.length - 1].nivel) + 1
        : indiceNivel(nivelInicial(contexto.filtros));
    return `<div class="nivel-abas" role="tablist" aria-label="Ver por">
        <span class="abas-rotulo">Ver por</span>
        ${NIVEIS.slice(minimo).map((n) => `<button type="button" class="nivel-aba ${n.chave === agrupamento ? "ativa" : ""}"
            data-agrupar="${n.chave}">${n.rotulo}</button>`).join("")}
    </div>`;
}

function barraResumo() {
    const ehLoja = agrupamento === "loja";
    const dicaLoja = contexto.foco === "tentativas"
        ? "Clique em uma loja para ver as tentativas por dia"
        : "Clique em uma loja para ver contratos e tentativas";
    const dica = ehLoja ? dicaLoja
        : `Clique em uma linha para abrir o ${NIVEIS[indiceNivel(agrupamento) + 1].rotulo}`;
    const rotuloIncluir = contexto.foco === "tentativas" ? "Incluir lojas ativas sem tentativa"
        : contexto.filtros.situacao && contexto.filtros.situacao !== "AVERBADO"
            ? "Incluir lojas ativas sem contratos nesta situação" : "Incluir lojas ativas sem consignado averbado";
    $("detalhe-barra").innerHTML = `
        ${abasAgrupamento()}
        <input type="search" id="detalhe-busca" class="campo-busca" placeholder="Buscar...">
        ${ehLoja ? `<label class="caixa"><input type="checkbox" id="detalhe-sem-movimento" ${incluirSemMovimento ? "checked" : ""}> ${rotuloIncluir}</label>` : ""}
        <span class="dica">${dica}</span>
        <button type="button" class="btn-secundario" id="detalhe-exportar">Exportar Excel</button>`;
    $("detalhe-barra").querySelectorAll("[data-agrupar]").forEach((b) =>
        b.addEventListener("click", () => { agrupamento = b.dataset.agrupar; mostrarResumo(); }));
    $("detalhe-sem-movimento")?.addEventListener("change", (e) => {
        if (e.target.checked && !baseIncluiSemMovimento) return carregarLojas(true);
        incluirSemMovimento = e.target.checked;
        mostrarResumo();
    });
}

function barraLoja() {
    const abas = contexto.foco === "tentativas"
        ? [["tentativas", `Tentativas por dia (${inteiro(dadosLoja.tentativas.length)})`]]
        : [
            ["contratos", `Contratos (${inteiro(dadosLoja.contratos.length)})`],
            ["tentativas", `Tentativas por dia (${inteiro(dadosLoja.tentativas.length)})`],
        ];
    $("detalhe-barra").innerHTML = `
        <div class="nivel-abas">${abas.map(([tipo, rotulo]) =>
            `<button type="button" class="nivel-aba ${visao.tipo === tipo ? "ativa" : ""}" data-aba="${tipo}">${rotulo}</button>`).join("")}</div>
        <input type="search" id="detalhe-busca" class="campo-busca" placeholder="Buscar...">
        <button type="button" class="btn-secundario" id="detalhe-exportar">Exportar Excel</button>`;
    $("detalhe-barra").querySelectorAll("[data-aba]").forEach((b) =>
        b.addEventListener("click", () => mostrarAbaLoja(b.dataset.aba)));
}

function definirVisao(tipo, colunas, linhas) {
    visao = { tipo, colunas, linhas };
    ordem = null;
    busca = "";
    renderizarCabecalho();
    if (contexto.contratosDireto) barraContratos(contexto.filtros, (situacao) => {
        contexto.filtros.situacao = situacao;
        chipsContexto();
        renderizarTabela();
    }, () => { renderizarTabela(); $("detalhe-tabela").parentElement.scrollTop = 0; }, (periodo) => {
        Object.assign(contexto.filtros, periodo);
        delete contexto.filtros.modo;
        delete contexto.filtros.du;
        chipsContexto();
        carregarContratosPeriodo();
    });
    else (loja ? barraLoja : barraResumo)();
    $("detalhe-busca").addEventListener("input", (e) => {
        busca = e.target.value;
        reiniciarPaginaContratos();
        renderizarTabela();
    });
    $("detalhe-exportar").addEventListener("click", () =>
        baixarXlsx("/api/exportar/detalhe", {
            ...contexto.filtros,
            visao: contexto.contratosDireto ? "contratos" : "",
            busca: contexto.contratosDireto ? busca : "",
            incluir_sem_movimento: incluirSemMovimento ? "1" : "",
            por_produto: porProduto() ? "1" : "",
        }, $("detalhe-exportar")));
    migalhas();
    renderizarTabela();
}

function mostrarResumo() {
    requisicao += 1; // Voltar ao resumo invalida uma consulta de loja em andamento.
    loja = null;
    $("detalhe-titulo").textContent = contexto.titulo;
    const lojas = filtrarPorTrilha(lojasBase, trilha);
    if (agrupamento === "loja") {
        definirVisao("lojas", colunasLojas(contexto.filtros, trilha), incluirSemMovimento ? lojas : lojas.filter(comMovimento));
    } else {
        let linhas = agrupar(lojas, agrupamento, contexto.foco, contexto.filtros.situacao);
        if (contexto.foco === "tentativas") linhas = linhas.filter((g) => g.qtd_tentativas > 0);
        definirVisao("grupos", colunasGrupo(agrupamento, contexto.filtros, trilha), linhas);
    }
}

function irParaTrilha(tamanho) {
    trilha = trilha.slice(0, tamanho);
    agrupamento = tamanho ? NIVEIS[indiceNivel(trilha[tamanho - 1].nivel) + 1].chave : nivelInicial(contexto.filtros);
    mostrarResumo();
}

function descer(grupo) {
    trilha.push({ nivel: agrupamento, valor: grupo[agrupamento] });
    agrupamento = NIVEIS[indiceNivel(agrupamento) + 1].chave;
    mostrarResumo();
}

function carregando() {
    visao = null;
    $("detalhe-cabecalho").innerHTML = "";
    $("detalhe-barra").innerHTML = "";
    $("detalhe-rodape").innerHTML = "";
    $("detalhe-corpo").innerHTML = linhaCarregandoTabela();
}

async function executar(acao) {
    const id = ++requisicao;
    const atual = () => id === requisicao;
    carregando();
    try {
        await acao(atual);
    } catch (erro) {
        if (!atual()) return;
        carregando();
        const celula = $("detalhe-corpo").querySelector("td");
        celula.className = "vazio alerta-texto";
        celula.textContent = erro.message + " ";
        const tentar = document.createElement("button");
        tentar.type = "button";
        tentar.className = "btn-secundario";
        tentar.textContent = "Tentar novamente";
        tentar.addEventListener("click", () => executar(acao));
        celula.append(tentar);
    }
}

function carregarLojas(incluir = incluirSemMovimento) {
    const filtros = { ...contexto.filtros, qualquer_movimento: "1",
        incluir_sem_movimento: incluir ? "1" : "", por_produto: porProduto() ? "1" : "" };
    return executar(async (atual) => {
        const dados = await buscar("/api/detalhe/lojas", filtros);
        if (!atual()) return;
        lojasBase = dados.linhas;
        baseIncluiSemMovimento = incluir;
        incluirSemMovimento = incluir;
        mostrarResumo();
    });
}

function carregarContratosPeriodo() {
    return executar(async (atual) => {
        const dados = await buscar("/api/detalhe/contratos", { ...contexto.filtros, situacao: "" });
        if (!atual()) return;
        Object.assign(contexto.filtros, dados.periodo);
        chipsContexto();
        definirVisao("contratos", colunasContratosPeriodo(contexto.filtros), dados.linhas);
        $("detalhe-busca").focus();
    });
}

function mostrarAbaLoja(tipo) {
    const colunas = tipo === "contratos" ? COLUNAS_CONTRATOS : COLUNAS_TENTATIVAS;
    definirVisao(tipo, colunas, dadosLoja[tipo]);
}

function abrirLoja(dadosDaLoja) {
    loja = dadosDaLoja;
    $("detalhe-titulo").textContent = `${loja.nome_loja} (${loja.chave_loja})`;
    migalhas();
    const filtros = { ...contexto.filtros, loja: loja.chave_loja };
    return executar(async (atual) => {
        const dados = await buscar("/api/detalhe/loja", filtros);
        if (!atual()) return;
        dadosLoja = dados;
        const abrirContratos = contexto.foco !== "tentativas" && (dadosLoja.contratos.length || contexto.filtros.situacao);
        mostrarAbaLoja(abrirContratos ? "contratos" : "tentativas");
    });
}

function fechar() {
    document.dispatchEvent(new Event("detalhe:fechar"));
    requisicao += 1;
    $("detalhe").classList.add("oculto");
    document.body.classList.remove("modal-aberto");
}

export function iniciarDetalhe() {
    document.querySelectorAll("#detalhe [data-fechar]").forEach((el) => el.addEventListener("click", fechar));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

    configurarOrdenacao("detalhe-tabela", (chave, crescente) => {
        if (!visao) return;
        ordem = { chave, crescente };
        reiniciarPaginaContratos();
        renderizarTabela();
    });

    $("detalhe-corpo").addEventListener("click", (e) => {
        const tr = e.target.closest("tr[data-indice]");
        if (!tr || !visao) return;
        const linha = $("detalhe-corpo")._linhas[Number(tr.dataset.indice)];
        if (visao.tipo === "grupos") descer(linha);
        else if (visao.tipo === "lojas") abrirLoja(linha);
    });
}

// Ponto de entrada usado por graficos, tabelas e cards
export function abrirDetalhe({ titulo, filtros = {}, foco = "", visaoInicial = "" }) {
    document.dispatchEvent(new Event("detalhe:abrir"));
    contexto = { titulo, foco, contratosDireto: visaoInicial === "contratos", filtros: { ...parametros(), ...filtros, foco } };
    delete contexto.filtros.incluir_sem_movimento;
    incluirSemMovimento = Boolean(filtros.incluir_sem_movimento);
    lojasBase = [];
    baseIncluiSemMovimento = false;
    loja = dadosLoja = visao = null;
    trilha = [];
    agrupamento = nivelInicial(contexto.filtros);
    chipsContexto();
    $("detalhe-titulo").textContent = titulo;
    $("detalhe-cabecalho").innerHTML = "";
    $("detalhe-migalhas").innerHTML = "";
    $("detalhe").classList.remove("oculto");
    document.body.classList.add("modal-aberto");
    if (contexto.contratosDireto) return carregarContratosPeriodo();
    return carregarLojas();
}
