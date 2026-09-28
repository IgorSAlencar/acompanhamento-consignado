// Linha de total (rodape) das tabelas do painel de detalhe
import { NIVEIS, indiceNivel } from "./detalhe-agrupar.js";
import { inteiro } from "./formato.js";

// Colunas que identificam a linha e nao devem ser somadas
const IDENTIFICADORES = new Set([
    "gerencia", "coordenacao", "supervisao", "chave_loja", "nome_loja",
    "dia", "produto", "situacao", "contrato", "nsu", "cpf",
]);

const PRODUTOS = ["INSS", "PRIVADO", "PUBLICO"];

function somar(linhas) {
    const total = {};
    const produtos = Object.fromEntries(PRODUTOS.map((p) => [p, { qtd_tentativas: 0, qtd_convertidas: 0, pct_conversao: 0 }]));
    let temProdutos = false;
    linhas.forEach((l) => {
        Object.entries(l).forEach(([campo, valor]) => {
            if (typeof valor === "number" && !IDENTIFICADORES.has(campo)) total[campo] = (total[campo] || 0) + valor;
        });
        if (!l.produtos) return;
        temProdutos = true;
        PRODUTOS.forEach((p) => {
            produtos[p].qtd_tentativas += l.produtos[p]?.qtd_tentativas || 0;
            produtos[p].qtd_convertidas += l.produtos[p]?.qtd_convertidas || 0;
        });
    });
    total.pct_conversao = total.qtd_tentativas ? (100 * total.qtd_convertidas) / total.qtd_tentativas : 0;
    if (temProdutos) {
        PRODUTOS.forEach((p) => {
            const item = produtos[p];
            item.pct_conversao = item.qtd_tentativas ? (100 * item.qtd_convertidas) / item.qtd_tentativas : 0;
        });
        total.produtos = produtos;
    }
    return total;
}

function rotuloContagem(tipo, agrupamento, quantidade) {
    const nomes = {
        grupos: NIVEIS[indiceNivel(agrupamento)]?.rotulo,
        lojas: quantidade === 1 ? "loja" : "lojas",
        contratos: quantidade === 1 ? "contrato" : "contratos",
        tentativas: quantidade === 1 ? "dia/produto" : "dias/produto",
    };
    return `${inteiro(quantidade)} ${nomes[tipo]}`;
}

export function htmlLinhaTotal(visao, linhas, agrupamento) {
    if (!linhas.length) return "";
    const total = somar(linhas);
    const celulas = visao.colunas.map((coluna, i) => {
        if (i === 0) {
            return `<td class="texto-esquerda"><strong>Total</strong>
                <small>${rotuloContagem(visao.tipo, agrupamento, linhas.length)}</small></td>`;
        }
        if (IDENTIFICADORES.has(coluna.chave)) return "<td></td>";
        return `<td class="${coluna.classe || ""} celula-produto">${coluna.html ? coluna.html(total) : inteiro(coluna.valor(total))}</td>`;
    });
    return `<tr>${celulas.join("")}</tr>`;
}
