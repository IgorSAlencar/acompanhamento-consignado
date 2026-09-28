// Painel de detalhe: qualquer numero -> resumo por nivel hierarquico -> lojas -> contratos / tentativas
import { buscar } from "./api.js";
import {
    NIVEIS, agrupar, colunasGrupo, colunasLojas, filtrarPorTrilha, indiceNivel, nivelInicial, temMovimento,
} from "./detalhe-agrupar.js";
import { COLUNAS_CONTRATOS, COLUNAS_TENTATIVAS, NOMES_PRODUTO, NOMES_SITUACAO, htmlCabecalho } from "./detalhe-colunas.js";
import { parametros } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";
import { descricaoDe } from "./filtros.js";
import { htmlLinhaTotal } from "./detalhe-total.js";
import { dataCurta, inteiro } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";

const $ = (id) => document.getElementById(id);
let contexto = null;      // { titulo, filtros, foco }
let lojasBase = [];       // todas as lojas do contexto (com e sem movimento)
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
    if (busca) {
        const termo = busca.toLowerCase();
        linhas = linhas.filter((l) => Object.values(l).some((v) => String(v).toLowerCase().includes(termo)));
    }
    if (ordem) {
        const coluna = visao.colunas.find((c) => c.chave === ordem.chave);
        linhas = ordenar(linhas, coluna.valor, ordem.crescente);
    }
    return linhas;
}

function chipsContexto() {
    const f = contexto.filtros;
    const chips = [f.data_ini === f.data_fim ? dataCurta(f.data_ini) : `${dataCurta(f.data_ini)} a ${dataCurta(f.data_fim)}`];
    chips.push(f.produto ? NOMES_PRODUTO[f.produto] : "Todos os produtos");
    if (f.situacao) chips.push(NOMES_SITUACAO[f.situacao]);
    ["gerencia", "coordenacao", "supervisao"].forEach((nivel) => {
        if (f[nivel]) chips.push(descricaoDe(nivel, f[nivel]));
    });
    $("detalhe-contexto").innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join("");
}

function migalhas() {
    const itens = [{ rotulo: "Resumo", acao: () => irParaTrilha(0) }];
    trilha.forEach((passo, i) => itens.push({ rotulo: passo.valor, acao: () => irParaTrilha(i + 1) }));
    if (loja) itens.push({ rotulo: loja.nome_loja });

    const alvo = $("detalhe-migalhas");
    alvo.innerHTML = itens.map((item, i) => {
        const ultimo = i === itens.length - 1;
        return `<button type="button" class="migalha" data-passo="${i}" ${ultimo ? "disabled" : ""}>${item.rotulo}</button>`;
    }).join('<span class="migalha-separador">&gt;</span>');
    alvo.querySelectorAll("[data-passo]:not([disabled])").forEach((b) =>
        b.addEventListener("click", () => itens[Number(b.dataset.passo)].acao()));
}

function renderizarCabecalho() {
    $("detalhe-cabecalho").innerHTML = htmlCabecalho(visao.colunas);
}

function renderizarTabela() {
    const linhas = linhasVisiveis();
    $("detalhe-rodape").innerHTML = htmlLinhaTotal(visao, linhas, agrupamento);
    const corpo = $("detalhe-corpo");
    if (!linhas.length) {
        corpo.innerHTML = `<tr><td colspan="${visao.colunas.length}" class="vazio">Nenhum registro encontrado.</td></tr>`;
        return;
    }
    const clicavel = visao.tipo === "grupos" || visao.tipo === "lojas";
    corpo.innerHTML = linhas.map((l, i) => `
        <tr class="${clicavel ? "linha-clicavel" : ""}" data-indice="${i}">
            ${visao.colunas.map((c) => `<td class="${c.classe || ""} celula-produto">${c.html ? c.html(l) : l[c.chave] ?? ""}</td>`).join("")}
        </tr>`).join("");
    corpo._linhas = linhas;
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
    const rotuloIncluir = contexto.foco === "tentativas" ? "Incluir lojas sem tentativa"
        : contexto.filtros.situacao && contexto.filtros.situacao !== "AVERBADO"
            ? "Incluir lojas sem contratos nesta situação" : "Incluir lojas sem consignado averbado";
    $("detalhe-barra").innerHTML = `
        ${abasAgrupamento()}
        <input type="search" id="detalhe-busca" class="campo-busca" placeholder="Buscar...">
        ${ehLoja ? `<label class="caixa"><input type="checkbox" id="detalhe-sem-movimento" ${incluirSemMovimento ? "checked" : ""}> ${rotuloIncluir}</label>` : ""}
        <span class="dica">${dica}</span>
        <button type="button" class="btn-secundario" id="detalhe-exportar">Exportar Excel</button>`;
    $("detalhe-barra").querySelectorAll("[data-agrupar]").forEach((b) =>
        b.addEventListener("click", () => { agrupamento = b.dataset.agrupar; mostrarResumo(); }));
    $("detalhe-sem-movimento")?.addEventListener("change", (e) => { incluirSemMovimento = e.target.checked; mostrarResumo(); });
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
    (loja ? barraLoja : barraResumo)();
    $("detalhe-busca").addEventListener("input", (e) => { busca = e.target.value; renderizarTabela(); });
    $("detalhe-exportar").addEventListener("click", () =>
        baixarXlsx("/api/exportar/detalhe", {
            ...contexto.filtros,
            incluir_sem_movimento: incluirSemMovimento ? "1" : "",
            por_produto: porProduto() ? "1" : "",
        }, $("detalhe-exportar")));
    migalhas();
    renderizarTabela();
}

function mostrarResumo() {
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

function carregando(mensagem = "Carregando...") {
    $("detalhe-rodape").innerHTML = "";
    $("detalhe-corpo").innerHTML = `<tr><td colspan="12" class="carregando">${mensagem}</td></tr>`;
}

async function executar(acao) {
    carregando();
    try {
        await acao();
    } catch (erro) {
        carregando(`<span class="alerta-texto">${erro.message}</span>`);
    }
}

function mostrarAbaLoja(tipo) {
    const colunas = tipo === "contratos" ? COLUNAS_CONTRATOS : COLUNAS_TENTATIVAS;
    definirVisao(tipo, colunas, dadosLoja[tipo]);
}

function abrirLoja(dadosDaLoja) {
    loja = dadosDaLoja;
    $("detalhe-titulo").textContent = `${loja.nome_loja} (${loja.chave_loja})`;
    migalhas();
    return executar(async () => {
        dadosLoja = await buscar("/api/detalhe/loja", { ...contexto.filtros, loja: loja.chave_loja });
        const abrirContratos = contexto.foco !== "tentativas" && (dadosLoja.contratos.length || contexto.filtros.situacao);
        mostrarAbaLoja(abrirContratos ? "contratos" : "tentativas");
    });
}

function fechar() {
    $("detalhe").classList.add("oculto");
    document.body.classList.remove("modal-aberto");
}

export function iniciarDetalhe() {
    document.querySelectorAll("#detalhe [data-fechar]").forEach((el) => el.addEventListener("click", fechar));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });

    configurarOrdenacao("detalhe-tabela", (chave, crescente) => {
        ordem = { chave, crescente };
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
export function abrirDetalhe({ titulo, filtros = {}, foco = "" }) {
    contexto = { titulo, foco, filtros: { ...parametros(), ...filtros, foco } };
    delete contexto.filtros.incluir_sem_movimento;
    incluirSemMovimento = Boolean(filtros.incluir_sem_movimento);
    trilha = [];
    agrupamento = nivelInicial(contexto.filtros);
    chipsContexto();
    $("detalhe").classList.remove("oculto");
    document.body.classList.add("modal-aberto");
    executar(async () => {
        const dados = await buscar("/api/detalhe/lojas", {
            ...contexto.filtros,
            incluir_sem_movimento: "1",
            por_produto: porProduto() ? "1" : "",
        });
        lojasBase = dados.linhas;
        mostrarResumo();
    });
}
