// Tabela de detalhamento diario (valores = averbado; aguardando/nao averbado a parte)
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { NOMES_PRODUTO, NOMES_SITUACAO } from "./detalhe-colunas.js";
import { estado, parametros } from "./estado.js";
import { dataCurta, diaSemana, inteiro, moedaCompacta } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";

const ORDEM_COLUNAS = ["INSS", "PUBLICO", "PRIVADO"];

const EXTRATORES = {
    dia: (l) => l.dia,
    inss: (l) => l.produtos.INSS.vlr,
    inss_tent: (l) => l.produtos.INSS.tentativas,
    publico: (l) => l.produtos.PUBLICO.vlr,
    publico_tent: (l) => l.produtos.PUBLICO.tentativas,
    privado: (l) => l.produtos.PRIVADO.vlr,
    privado_tent: (l) => l.produtos.PRIVADO.tentativas,
    total: (l) => l.total_vlr,
    aguardando: (l) => l.vlr_aguardando,
    nao_averbado: (l) => l.vlr_nao_averbado,
};

let linhasCache = [];

// Atributos que o clique usa para abrir o detalhe por loja
const alvo = (dia, produto = "", situacao = "") =>
    `data-dia="${dia}" data-produto="${produto}" data-situacao="${situacao}"`;

function celulasProduto(dia, produtos) {
    return ORDEM_COLUNAS.map((nome) => {
        const p = produtos[nome];
        const classe = `col-${nome.toLowerCase()} clicavel`;
        return `
            <td class="${classe} celula-produto" ${alvo(dia, nome, "AVERBADO")}>
                <strong>${inteiro(p.qtd)}</strong>
                <small>${moedaCompacta(p.vlr)}</small>
            </td>
            <td class="${classe}" ${alvo(dia, nome)}>${inteiro(p.tentativas)} / ${inteiro(p.convertidas)}</td>`;
    }).join("");
}

function renderizar(linhas) {
    const corpo = document.getElementById("tabela-diaria-corpo");

    if (!linhas.length) {
        corpo.innerHTML = '<tr><td colspan="10" class="vazio">Sem movimento no periodo selecionado.</td></tr>';
        return;
    }

    corpo.innerHTML = linhas.map((l) => `
        <tr>
            <td class="clicavel" ${alvo(l.dia)}>${dataCurta(l.dia)} <small class="dia-semana">${diaSemana(l.dia)}</small></td>
            ${celulasProduto(l.dia, l.produtos)}
            <td class="valor-total clicavel" ${alvo(l.dia, "", "AVERBADO")}>${moedaCompacta(l.total_vlr)}</td>
            <td class="clicavel" ${alvo(l.dia, "", "AGUARDANDO AVERBACAO")}>${inteiro(l.qtd_aguardando)} &middot; ${moedaCompacta(l.vlr_aguardando)}</td>
            <td class="clicavel" ${alvo(l.dia, "", "NAO AVERBADO")}>${inteiro(l.qtd_nao_averbado)} &middot; ${moedaCompacta(l.vlr_nao_averbado)}</td>
        </tr>`).join("");
}

function tituloDetalhe({ dia, produto, situacao }) {
    const partes = [dataCurta(dia)];
    if (produto) partes.push(NOMES_PRODUTO[produto]);
    if (situacao) partes.push(NOMES_SITUACAO[situacao]);
    return `Detalhe · ${partes.join(" · ")}`;
}

export function iniciarOrdenacaoTabela() {
    configurarOrdenacao("tabela-diaria", (chave, crescente) => {
        renderizar(ordenar(linhasCache, EXTRATORES[chave], crescente));
    });

    document.getElementById("tabela-diaria-corpo").addEventListener("click", (e) => {
        const td = e.target.closest("td[data-dia]");
        if (!td) return;
        const { dia, produto, situacao } = td.dataset;
        abrirDetalhe({
            titulo: tituloDetalhe(td.dataset),
            filtros: { data_ini: dia, data_fim: dia, produto: produto || estado.produto, situacao },
        });
    });
}

export function tabelaCarregando() {
    document.getElementById("tabela-diaria-corpo").innerHTML =
        '<tr><td colspan="10" class="carregando">Carregando...</td></tr>';
}

export async function carregarTabela() {
    const dados = await buscar("/api/tabela-diaria", parametros());
    linhasCache = dados.linhas;
    renderizar(linhasCache);
}
