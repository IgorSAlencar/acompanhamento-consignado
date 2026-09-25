// Tabela de detalhamento diario (valores = averbado; aguardando/nao averbado a parte)
import { buscar } from "./api.js";
import { exportarTabela } from "./tabela-exportar.js";
import { abrirDetalhe } from "./detalhe.js";
import { NOMES_PRODUTO, NOMES_SITUACAO } from "./detalhe-colunas.js";
import { estado, parametros } from "./estado.js";
import { blocoValor, dataCurta, diaSemana, inteiro, moedaCompacta, semValor } from "./formato.js";
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
let linhasVisiveis = [];

// Atributos que o clique usa para abrir o detalhe por loja
const alvo = (dia, produto = "", situacao = "") =>
    `data-dia="${dia}" data-produto="${produto}" data-situacao="${situacao}"`;

function celulasProduto(dia, produtos) {
    return ORDEM_COLUNAS.map((nome) => {
        const p = produtos[nome];
        const classe = `col-${nome.toLowerCase()} clicavel`;
        const tentativas = p.tentativas || p.convertidas
            ? `${inteiro(p.tentativas)} / ${inteiro(p.convertidas)}`
            : semValor();
        return `
            <td class="${classe} celula-produto" ${alvo(dia, nome, "AVERBADO")}>
                ${blocoValor(p.vlr, p.qtd, moedaCompacta, false, p.lojas)}
            </td>
            <td class="${classe}" ${alvo(dia, nome)}>${tentativas}</td>`;
    }).join("");
}

function renderizar(linhas) {
    linhasVisiveis = linhas;
    const corpo = document.getElementById("tabela-diaria-corpo");

    if (!linhas.length) {
        corpo.innerHTML = '<tr><td colspan="10" class="vazio">Sem movimento no periodo selecionado.</td></tr>';
        return;
    }

    corpo.innerHTML = linhas.map((l) => `
        <tr>
            <td class="clicavel" ${alvo(l.dia)}>${dataCurta(l.dia)} <small class="dia-semana">${diaSemana(l.dia)}</small></td>
            ${celulasProduto(l.dia, l.produtos)}
            <td class="celula-produto clicavel" ${alvo(l.dia, "", "AVERBADO")}>${blocoValor(l.total_vlr, l.total_qtd, moedaCompacta, true, l.total_lojas)}</td>
            <td class="celula-produto clicavel" ${alvo(l.dia, "", "AGUARDANDO AVERBACAO")}>${blocoValor(l.vlr_aguardando, l.qtd_aguardando, moedaCompacta, false, l.lojas_aguardando)}</td>
            <td class="celula-produto clicavel" ${alvo(l.dia, "", "NAO AVERBADO")}>${blocoValor(l.vlr_nao_averbado, l.qtd_nao_averbado, moedaCompacta, false, l.lojas_nao_averbado)}</td>
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

    document.getElementById("tabela-exportar").addEventListener("click", () => {
        if (!linhasVisiveis.length) return;
        exportarTabela({
            linhas: linhasVisiveis,
            dataIni: estado.dataIni,
            dataFim: estado.dataFim,
        });
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
