// Secao Equipe: visao por nivel com pais, ordenacao, drill-down e chips
import { buscar } from "./api.js";
import { exportarEquipe } from "./equipe-exportar.js";
import { abrirDetalhe } from "./detalhe.js";
import { NOMES_PRODUTO } from "./detalhe-colunas.js";
import { estado, parametros } from "./estado.js";
import { descricaoDe, selecionar } from "./filtros.js";
import { inteiro, moedaCompacta, percentual, semValor, textoLojas } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";
import { linhaCarregandoTabela } from "./tabela-carregamento.js";

const ROTULOS = {
    gerencia: "Ger. Gest&atilde;o",
    coordenacao: "Ger. Comercial III",
    supervisao: "Ger. Comercial",
};

const EXTRATORES = {
    descricao: (l) => l.descricao,
    pai_gerencia: (l) => l.pai_gerencia || "",
    pai_coordenacao: (l) => l.pai_coordenacao || "",
    cobertura: (l) => l.pct_cobertura,
    inss: (l) => l.produtos.INSS.vlr,
    privado: (l) => l.produtos.PRIVADO.vlr,
    publico: (l) => l.produtos.PUBLICO.vlr,
};

let dadosCache = null;
let aoNavegar = null;
let filtroSemTentativa = null;   // produto cujo chip "sem tentativa" esta ativo
let ordem = null;

function celulaProduto(produto, nome) {
    const classe = `col-${nome.toLowerCase()} clicavel${filtroSemTentativa === nome ? " foco-sem-tentativa" : ""}`;
    const conversao = produto.tentativas
        ? `${inteiro(produto.tentativas)} tent. &middot; ${percentual(produto.pct_conversao)} conv.`
        : '<span class="alerta-texto">Sem tentativa</span>';
    const aguardando = produto.vlr_aguardando > 0
        ? `<small class="aguardando">+ ${moedaCompacta(produto.vlr_aguardando)} aguardando averba&ccedil;&atilde;o</small>`
        : "";
    const producao = produto.vlr || produto.qtd
        ? `<strong>${moedaCompacta(produto.vlr)}</strong>
            <small>${inteiro(produto.qtd)} oper. &middot; ${textoLojas(produto.lojas)} &middot; ${conversao}</small>`
        : (produto.tentativas ? `<small>${conversao}</small>` : semValor());
    return `
        <td class="${classe} celula-produto" data-produto="${nome}">
            ${producao}
            ${aguardando}
        </td>`;
}

function montarCabecalho(dados) {
    const pais = dados.pais
        .map((nivel) => `<th data-chave="pai_${nivel}">${ROTULOS[nivel]}</th>`)
        .join("");
    document.getElementById("tabela-equipe-cabecalho").innerHTML = `
        <tr>
            ${pais}
            <th data-chave="descricao">${dados.rotulo}</th>
            <th data-chave="cobertura">Cobertura</th>
            <th class="col-inss" data-chave="inss">INSS</th>
            <th class="col-privado" data-chave="privado">Privado</th>
            <th class="col-publico" data-chave="publico">P&uacute;blico</th>
        </tr>`;
}

function montarMigalhas() {
    const alvo = document.getElementById("equipe-migalhas");
    const partes = [{ rotulo: "Todas", acao: () => selecionar("gerencia", "") }];

    if (estado.gerencia) {
        partes.push({ rotulo: descricaoDe("gerencia", estado.gerencia), acao: () => selecionar("gerencia", estado.gerencia) });
    }
    if (estado.coordenacao) {
        partes.push({ rotulo: descricaoDe("coordenacao", estado.coordenacao), acao: () => selecionar("coordenacao", estado.coordenacao) });
    }

    alvo.innerHTML = "";
    partes.forEach((parte, indice) => {
        if (indice > 0) {
            const separador = document.createElement("span");
            separador.className = "migalha-separador";
            separador.textContent = ">";
            alvo.appendChild(separador);
        }
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "migalha";
        botao.textContent = parte.rotulo;
        if (indice === partes.length - 1) {
            botao.disabled = true;
        } else {
            botao.addEventListener("click", () => {
                parte.acao();
                estado.nivelEquipe = indice === 0 ? "gerencia" : "coordenacao";
                aoNavegar();
            });
        }
        alvo.appendChild(botao);
    });
}

function montarChips(dados) {
    const alvo = document.getElementById("equipe-chips");
    const total = `<button type="button" class="chip chip-filtro ${filtroSemTentativa ? "" : "ativo"}" data-filtro=""
        title="Mostrar todos">${inteiro(dados.total_entidades)} ${dados.rotulo.toLowerCase()}</button>`;
    alvo.innerHTML = total + Object.entries(dados.sem_tentativa).map(([produto, qtd]) => {
        const ativo = filtroSemTentativa === produto;
        return `<button type="button" class="chip chip-filtro ${qtd > 0 ? "alerta" : ""} ${ativo ? "ativo" : ""}"
            data-filtro="${produto}" ${qtd ? "" : "disabled"}
            title="${ativo ? "Clique para limpar o filtro" : `Ver quem está sem tentativa em ${NOMES_PRODUTO[produto]}`}">
            ${inteiro(qtd)} sem tentativa ${NOMES_PRODUTO[produto]}${ativo ? " &times;" : ""}
        </button>`;
    }).join("");
}

function aoClicarChip(evento) {
    const chip = evento.target.closest("[data-filtro]");
    if (!chip || chip.disabled || !dadosCache) return;
    const produto = chip.dataset.filtro;
    filtroSemTentativa = produto && produto !== filtroSemTentativa ? produto : null;
    montarChips(dadosCache);
    atualizarCorpo();
}

function linhasAtuais() {
    let linhas = dadosCache.linhas;
    if (filtroSemTentativa) linhas = linhas.filter((l) => l.produtos[filtroSemTentativa].tentativas === 0);
    if (ordem) linhas = ordenar(linhas, EXTRATORES[ordem.chave], ordem.crescente);
    return linhas;
}

function atualizarCorpo() {
    renderizarCorpo(linhasAtuais());
}

function renderizarCorpo(linhas) {
    const dados = dadosCache;
    const corpo = document.getElementById("tabela-equipe-corpo");
    const totalColunas = 5 + dados.pais.length;

    if (!linhas.length) {
        const mensagem = filtroSemTentativa
            ? `Todos têm tentativa em ${NOMES_PRODUTO[filtroSemTentativa]}.` : "Nenhuma equipe encontrada.";
        corpo.innerHTML = `<tr><td colspan="${totalColunas}" class="vazio">${mensagem}</td></tr>`;
        return;
    }

    corpo.innerHTML = linhas.map((linha) => {
        const pais = dados.pais.map((nivel) => {
            const valor = nivel === "gerencia" ? linha.pai_gerencia : linha.pai_coordenacao;
            return `<td class="celula-pai">${valor || "&ndash;"}</td>`;
        }).join("");
        return `
        <tr class="${dados.proximo_nivel ? "linha-drill" : ""}" data-chave="${linha.chave}" data-descricao="${linha.descricao}">
            ${pais}
            <td class="celula-nome" title="${dados.proximo_nivel ? "Descer para o proximo nivel" : ""}">${linha.descricao}</td>
            <td class="clicavel" data-cobertura="1">${inteiro(linha.qtd_lojas_producao)}/${inteiro(linha.qtd_lojas)} ativas (${percentual(linha.pct_cobertura)})</td>
            ${celulaProduto(linha.produtos.INSS, "INSS")}
            ${celulaProduto(linha.produtos.PRIVADO, "PRIVADO")}
            ${celulaProduto(linha.produtos.PUBLICO, "PUBLICO")}
        </tr>`;
    }).join("");

}

function aoClicarCorpo(evento) {
    const tr = evento.target.closest("tr[data-chave]");
    if (!tr || !dadosCache) return;
    const { nivel, proximo_nivel: proximo } = dadosCache;

    const td = evento.target.closest("td[data-produto], td[data-cobertura]");
    if (td) {
        const produto = td.dataset.produto || estado.produto;
        abrirDetalhe({
            titulo: `Detalhe · ${tr.dataset.descricao}${td.dataset.produto ? ` · ${NOMES_PRODUTO[produto]}` : ""}`,
            filtros: {
                [nivel]: tr.dataset.chave,
                produto,
                incluir_sem_movimento: Boolean(td.dataset.cobertura),
            },
        });
        return;
    }

    if (proximo && evento.target.closest(".celula-nome")) {
        selecionar(nivel, tr.dataset.chave);
        estado.nivelEquipe = proximo;
        aoNavegar();
    }
}

export function iniciarControlesEquipe(recarregarTudo) {
    aoNavegar = recarregarTudo;

    // Seletor de visao geral por nivel
    const abas = document.querySelectorAll("#equipe-niveis .nivel-aba");
    abas.forEach((aba) => {
        aba.addEventListener("click", () => {
            estado.nivelEquipe = aba.dataset.nivel;
            equipeCarregando();
            carregarEquipe(recarregarTudo);
        });
    });

    document.getElementById("tabela-equipe-corpo").addEventListener("click", aoClicarCorpo);
    document.getElementById("equipe-chips").addEventListener("click", aoClicarChip);
    document.getElementById("equipe-exportar").addEventListener("click", () => {
        exportarEquipe(document.getElementById("equipe-exportar"));
    });

    configurarOrdenacao("tabela-equipe", (chave, crescente) => {
        ordem = { chave, crescente };
        atualizarCorpo();
    });
}

export function equipeCarregando() {
    document.getElementById("tabela-equipe-corpo").innerHTML =
        linhaCarregandoTabela();
}

export async function carregarEquipe(recarregarTudo) {
    aoNavegar = recarregarTudo;
    const dados = await buscar("/api/equipe", { ...parametros(), nivel: estado.nivelEquipe });
    dadosCache = dados;
    ordem = null;
    if (filtroSemTentativa && !dados.sem_tentativa[filtroSemTentativa]) filtroSemTentativa = null;

    document.querySelectorAll("#equipe-niveis .nivel-aba").forEach((aba) => {
        aba.classList.toggle("ativa", aba.dataset.nivel === dados.nivel);
    });

    montarCabecalho(dados);
    montarMigalhas();
    montarChips(dados);
    atualizarCorpo();
}
