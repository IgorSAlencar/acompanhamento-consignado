// Ranking da aba Dia Util: status vs proprio historico, chips e drill-down
import { buscar } from "./api.js";
import { abrirDetalhe } from "./detalhe.js";
import { exportarRankingDu } from "./du-exportar.js";
import { FORMATOS_METRICA, NOMES_METRICA, desenharCurvas } from "./du-grafico.js";
import { atualizarCartaoAlerta } from "./du-kpis.js";
import { estado, parametrosDu } from "./estado.js";
import { descricaoDe, selecionar } from "./filtros.js";
import { inteiro, mesAno, semValor } from "./formato.js";
import { configurarOrdenacao, ordenar } from "./ordenacao.js";
import { linhaCarregandoTabela } from "./tabela-carregamento.js";

const NOMES_STATUS = {
    zerado: "Zerado",
    abaixo: "Abaixo",
    atencao: "Atenção",
    padrao: "No padrão",
    acima: "Acima",
    novo: "Novo",
};

const ROTULOS_PAI = {
    gerencia: "Ger. Gestão",
    coordenacao: "Ger. Comercial III",
    supervisao: "Ger. Comercial",
};
const CAMPO_PAI = {
    gerencia: "pai_gerencia",
    coordenacao: "pai_coordenacao",
    supervisao: "pai_supervisao",
};

const EXTRATORES = {
    descricao: (l) => l.descricao,
    pai_gerencia: (l) => l.pai_gerencia || "",
    pai_coordenacao: (l) => l.pai_coordenacao || "",
    pai_supervisao: (l) => l.pai_supervisao || "",
    atual_du: (l) => l.atual_du,
    atual_acum: (l) => l.atual_acum,
    desvio: (l) => (l.desvio_pct == null ? Number.NEGATIVE_INFINITY : l.desvio_pct),
    diferenca: (l) => l.diferenca || 0,
    lojas: (l) => l.lojas_acum,
    parado: (l) => l.dus_parado,
    status: (l) => l.status,
};

let dados = null;
let ordem = null;
let busca = "";
let chipAtivo = null; // "zerado" | "abaixo" | "parados"
let lojaAberta = null;
let curvaLoja = null;

const corpo = () => document.getElementById("du-tabela-corpo");
const umaCasa = (valor) => (valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function filtroChip(id) {
    return {
        zerado: (l) => l.status === "zerado",
        abaixo: (l) => l.status === "abaixo",
        parados: (l) => l.dus_parado >= dados.dus_parado_alerta && l.status !== "novo",
    }[id];
}

function linhasAtuais() {
    let linhas = dados.linhas;
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (termo) {
        linhas = linhas.filter((linha) =>
            [linha.descricao, linha.chave, linha.pai_gerencia, linha.pai_coordenacao, linha.pai_supervisao]
                .some((valor) => String(valor || "").toLocaleLowerCase("pt-BR").includes(termo)));
    }
    if (chipAtivo) linhas = linhas.filter(filtroChip(chipAtivo));
    if (ordem) linhas = ordenar(linhas, EXTRATORES[ordem.chave], ordem.crescente);
    return linhas;
}

function totalColunas() {
    return (dados.pais || []).length + (dados.nivel === "loja" ? 7 : 8);
}

function htmlPaisCabecalho() {
    return (dados.pais || []).map((n) => `<th data-chave="${CAMPO_PAI[n]}">${ROTULOS_PAI[n]}</th>`).join("");
}

function htmlPaisLinha(linha) {
    return (dados.pais || []).map((n) =>
        `<td class="celula-pai">${linha[CAMPO_PAI[n]] || "&ndash;"}</td>`).join("");
}

function seta(chave) {
    if (!ordem || ordem.chave !== chave) return "";
    return ` data-direcao="${ordem.crescente ? "asc" : "desc"}"`;
}

function montarCabecalho() {
    const nome = NOMES_METRICA[estado.du.metrica];
    const colunaLojas = dados.nivel === "loja"
        ? ""
        : `<th data-chave="lojas" class="th-quebra">Lojas produtivas até DU ${dados.du}</th>`;
    document.getElementById("du-tabela-cabecalho").innerHTML = `
        <tr>
            ${htmlPaisCabecalho()}
            <th data-chave="descricao">${dados.rotulo}</th>
            <th data-chave="atual_du" class="th-quebra">${nome} no DU ${dados.du}</th>
            <th data-chave="atual_acum" class="th-quebra">Acumulado até DU ${dados.du}</th>
            <th data-chave="diferenca" class="th-quebra"${seta("diferenca")} title="Acumulado deste mês menos a média. A soma das linhas é o mesmo afastamento do resumo.">Diferença</th>
            <th data-chave="desvio" class="th-quebra"${seta("desvio")}>Desvio vs meses anteriores</th>
            ${colunaLojas}
            <th data-chave="parado" class="th-quebra">Último DU com produção</th>
            <th data-chave="status">Status</th>
        </tr>`;
}

function montarMigalhas() {
    const alvo = document.getElementById("du-migalhas");
    const partes = [{ rotulo: "Todas", nivel: "gerencia", chave: "" }];
    if (estado.gerencia) {
        partes.push({ rotulo: descricaoDe("gerencia", estado.gerencia), nivel: "gerencia", chave: estado.gerencia });
    }
    if (estado.coordenacao) {
        partes.push({ rotulo: descricaoDe("coordenacao", estado.coordenacao), nivel: "coordenacao", chave: estado.coordenacao });
    }
    if (estado.supervisao) {
        partes.push({ rotulo: descricaoDe("supervisao", estado.supervisao), nivel: "supervisao", chave: estado.supervisao });
    }
    const proximo = { gerencia: "coordenacao", coordenacao: "supervisao", supervisao: "loja" };
    alvo.innerHTML = "";
    partes.forEach((parte, i) => {
        if (i) {
            const sep = document.createElement("span");
            sep.className = "migalha-separador";
            sep.textContent = ">";
            alvo.appendChild(sep);
        }
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "migalha";
        botao.textContent = parte.rotulo;
        if (i === partes.length - 1) {
            botao.disabled = true;
        } else {
            botao.addEventListener("click", () => {
                selecionar(parte.nivel, parte.chave);
                estado.du.nivel = parte.chave ? proximo[parte.nivel] : "gerencia";
                controles.aoNavegar();
            });
        }
        alvo.appendChild(botao);
    });
}

function montarChips() {
    const contagens = {
        zerado: dados.resumo.zerado,
        abaixo: dados.resumo.abaixo,
        parados: dados.resumo.parados,
    };
    const rotulos = {
        zerado: "zerados no mês",
        abaixo: "abaixo do padrão",
        parados: `parados há ${dados.dus_parado_alerta}+ DUs`,
    };
    const total = `<button type="button" class="chip chip-filtro ${chipAtivo ? "" : "ativo"}"
        data-chip="" title="Mostrar todos">${inteiro(dados.total_entidades)} no total</button>`;
    document.getElementById("du-chips").innerHTML = total + Object.keys(rotulos).map((id) => {
        const qtd = contagens[id];
        const ativo = chipAtivo === id;
        return `<button type="button" class="chip chip-filtro ${qtd > 0 ? "alerta" : ""} ${ativo ? "ativo" : ""}"
            data-chip="${id}" ${qtd ? "" : "disabled"}
            title="${ativo ? "Clique para limpar o filtro" : "Filtrar a tabela"}">
            ${inteiro(qtd)} ${rotulos[id]}${ativo ? " &times;" : ""}
        </button>`;
    }).join("");
}

function htmlDesvio(linha) {
    if (linha.desvio_pct == null) return semValor();
    const classe = linha.desvio_pct < 0 ? "desvio-negativo" : "desvio-positivo";
    return `<span class="${classe}">${linha.desvio_pct > 0 ? "+" : ""}${umaCasa(linha.desvio_pct)}%</span>`;
}

function rotuloMesesAnteriores() {
    const nomes = (dados.meses || [])
        .filter((mes) => mes !== dados.mes_ref)
        .map(mesAno);
    if (nomes.length <= 1) return nomes[0] || "os meses anteriores";
    if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
    if (nomes.length === 3) return `${nomes[0]}, ${nomes[1]} e ${nomes[2]}`;
    return `${nomes.length} meses anteriores`;
}

function atualizarLegendaMedia() {
    const alvo = document.getElementById("du-legenda-media");
    const meses = rotuloMesesAnteriores();
    const loja = dados.nivel === "loja"
        ? " Na loja, a lista abre pela maior queda em valor."
        : "";
    alvo.textContent = `A média é o que essa linha fez em ${meses}, no mesmo dia útil. Não é a média dos dias deste mês. Diferença = este mês − média; somando as lojas, é o mesmo afastamento do resumo.${loja}`;
}

function formatarComSinal(valor, formatar) {
    if (!valor) return formatar(0);
    const texto = formatar(Math.abs(valor));
    return valor > 0 ? `+${texto}` : `-${texto}`;
}

function htmlDif(linha, formatar) {
    const valor = linha.diferenca || 0;
    if (!valor && linha.desvio_pct == null && !linha.atual_acum) return semValor();
    const classe = valor < 0 ? "desvio-negativo" : "desvio-positivo";
    return `<span class="${classe}">${formatarComSinal(valor, formatar)}</span>`;
}

function blocoComMedia(atual, media, formatar, formatarMedia = formatar) {
    if (!atual && !media) return semValor();
    return `<strong>${formatar(atual)}</strong><small>meses ant.: ${formatarMedia(media)}</small>`;
}

function renderizarCorpo() {
    const formatar = FORMATOS_METRICA[estado.du.metrica];
    const linhas = linhasAtuais();
    const ehLoja = dados.nivel === "loja";

    if (!linhas.length) {
        corpo().innerHTML = `<tr><td colspan="${totalColunas()}" class="vazio">Nenhum registro no filtro atual.</td></tr>`;
        document.getElementById("du-tabela-rodape").innerHTML = "";
        return;
    }

    corpo().innerHTML = linhas.map((linha, i) => {
        const colunaLojas = ehLoja ? "" : `
            <td class="celula-produto">${blocoComMedia(linha.lojas_acum, linha.media_lojas, inteiro, umaCasa)}</td>`;
        const codigo = ehLoja && !String(linha.descricao).includes(String(linha.chave))
            ? `<small class="celula-codigo">${linha.chave}</small>` : "";
        const parado = linha.dus_parado >= dados.dus_parado_alerta
            ? `<small class="celula-parado">parado há ${linha.dus_parado} DUs</small>`
            : (linha.dus_parado > 0 ? `<small>${linha.dus_parado} DU(s) sem produzir</small>` : "");
        const ultimo = linha.ultimo_du ? `DU ${linha.ultimo_du}` : '<span class="sem-valor">nenhum</span>';
        const titulo = ehLoja ? "Ver a curva desta loja" : "Descer para o próximo nível";
        return `
        <tr class="linha-drill" data-indice="${i}" title="${titulo}">
            ${htmlPaisLinha(linha)}
            <td class="celula-nome">${linha.descricao}${codigo}</td>
            <td class="celula-produto">${blocoComMedia(linha.atual_du, linha.media_du, formatar)}</td>
            <td class="celula-produto">${blocoComMedia(linha.atual_acum, linha.media_acum, formatar)}</td>
            <td>${htmlDif(linha, estado.du.metrica === "lojas" ? umaCasa : formatar)}</td>
            <td>${htmlDesvio(linha)}</td>
            ${colunaLojas}
            <td class="celula-produto">${ultimo}${parado}</td>
            <td><span class="badge-status status-${linha.status}">${NOMES_STATUS[linha.status]}</span></td>
        </tr>`;
    }).join("");
    corpo()._linhas = linhas;
    montarRodape(linhas, formatar, ehLoja);
}

function montarRodape(linhas, formatar, ehLoja) {
    const soma = linhas.reduce((acc, linha) => {
        acc.du += linha.atual_du || 0;
        acc.acum += linha.atual_acum || 0;
        acc.media += linha.media_acum || 0;
        acc.dif += linha.diferenca || 0;
        acc.lojas += linha.lojas_acum || 0;
        return acc;
    }, { du: 0, acum: 0, media: 0, dif: 0, lojas: 0 });
    const formatarDif = estado.du.metrica === "lojas" ? umaCasa : formatar;
    const recorte = busca.trim() || chipAtivo ? "Soma do que está na lista" : "Soma da lista";
    const lojas = ehLoja ? "" : `<td class="celula-produto">${inteiro(soma.lojas)}</td>`;
    const classe = soma.dif < 0 ? "desvio-negativo" : "desvio-positivo";
    document.getElementById("du-tabela-rodape").innerHTML = `
        <tr>
            <td colspan="${(dados.pais || []).length + 1}">${recorte}. A diferença é o afastamento do resumo.</td>
            <td class="celula-produto"><strong>${formatar(soma.du)}</strong></td>
            <td class="celula-produto"><strong>${formatar(soma.acum)}</strong><small>meses ant.: ${formatar(soma.media)}</small></td>
            <td class="${classe}">${formatarComSinal(soma.dif, formatarDif)}</td>
            <td></td>
            ${lojas}
            <td></td>
            <td></td>
        </tr>`;
}

export function fecharCurvaLoja() {
    lojaAberta = null;
    curvaLoja = null;
    document.getElementById("du-loja-painel").classList.add("oculto");
}

export function redesenharCurvaLoja() {
    if (!curvaLoja) return;
    desenharCurvas("du-loja-grafico", curvaLoja, {
        metrica: estado.du.metrica === "lojas" ? "vlr" : estado.du.metrica,
        visao: estado.du.visao,
    });
}

async function abrirCurvaLoja(linha) {
    lojaAberta = linha;
    const painel = document.getElementById("du-loja-painel");
    const titulo = document.getElementById("du-loja-titulo");
    painel.classList.remove("oculto");
    titulo.textContent = `${linha.descricao} (${linha.chave}) · carregando...`;
    try {
        curvaLoja = await buscar("/api/du/curva", { ...parametrosDu(), loja: linha.chave });
        titulo.textContent = `${linha.descricao} (${linha.chave}) · curva por dia útil`;
        redesenharCurvaLoja();
        painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (erro) {
        titulo.textContent = `${linha.descricao} · ${erro.message}`;
    }
}

function aoClicarCorpo(evento) {
    const tr = evento.target.closest("tr[data-indice]");
    if (!tr || !dados) return;
    const linha = corpo()._linhas[Number(tr.dataset.indice)];
    if (dados.nivel === "loja") {
        abrirCurvaLoja(linha);
        return;
    }
    selecionar(dados.nivel, linha.chave);
    estado.du.nivel = dados.proximo_nivel;
    controles.aoNavegar();
}

export function rankingCarregando() {
    corpo().innerHTML = linhaCarregandoTabela();
    document.getElementById("du-tabela-rodape").innerHTML = "";
}

export function rankingErro(mensagem) {
    corpo().innerHTML = `<tr><td colspan="7" class="vazio"><span class="alerta-texto">${mensagem}</span></td></tr>`;
    const alerta = document.getElementById("du-kpi-alerta");
    alerta.classList.remove("skeleton");
    alerta.textContent = "–";
}

export async function carregarRanking() {
    dados = await buscar("/api/du/ranking", {
        ...parametrosDu(),
        nivel: estado.du.nivel,
        metrica: estado.du.metrica,
    });
    ordem = dados.nivel === "loja"
        ? { chave: "diferenca", crescente: true }
        : { chave: "desvio", crescente: false };
    document.querySelectorAll("#du-niveis .nivel-aba").forEach((aba) => {
        aba.classList.toggle("ativa", aba.dataset.nivel === dados.nivel);
    });
    montarCabecalho();
    atualizarLegendaMedia();
    montarMigalhas();
    montarChips();
    renderizarCorpo();
    atualizarCartaoAlerta(dados);
    return dados;
}

let controles = { aoNavegar: null, aoTrocarNivel: null };

export function iniciarRanking({ aoNavegar, aoTrocarNivel }) {
    controles = { aoNavegar, aoTrocarNivel };

    document.querySelectorAll("#du-niveis .nivel-aba").forEach((aba) => {
        aba.addEventListener("click", () => {
            estado.du.nivel = aba.dataset.nivel;
            fecharCurvaLoja();
            controles.aoTrocarNivel();
        });
    });

    document.getElementById("du-busca").addEventListener("input", (evento) => {
        busca = evento.target.value;
        if (dados) renderizarCorpo();
    });

    document.getElementById("du-chips").addEventListener("click", (evento) => {
        const chip = evento.target.closest("[data-chip]");
        if (!chip || chip.disabled || !dados) return;
        const id = chip.dataset.chip;
        chipAtivo = id && id !== chipAtivo ? id : null;
        montarChips();
        renderizarCorpo();
    });

    corpo().addEventListener("click", aoClicarCorpo);

    document.getElementById("du-exportar").addEventListener("click", () => {
        exportarRankingDu(document.getElementById("du-exportar"));
    });

    configurarOrdenacao("du-tabela", (chave, crescente) => {
        ordem = { chave, crescente };
        renderizarCorpo();
    });

    document.getElementById("du-loja-fechar").addEventListener("click", fecharCurvaLoja);

    document.getElementById("du-loja-contratos").addEventListener("click", () => {
        if (!lojaAberta || !curvaLoja) return;
        abrirDetalhe({
            titulo: `Detalhe · ${lojaAberta.descricao}`,
            filtros: {
                loja: lojaAberta.chave,
                produto: estado.du.produto,
                data_ini: curvaLoja.mes_ref_ini,
                data_fim: curvaLoja.mes_ref_fim,
            },
        });
    });
}
