import { COLUNAS_CONTRATOS, NOMES_SITUACAO } from "./detalhe-colunas.js";
import { colunasLojas } from "./detalhe-agrupar.js";
import { inteiro } from "./formato.js";

let pagina = 1;
const TAMANHO_PAGINA = 100;

export function colunasContratosPeriodo(filtros) {
    const hierarquia = colunasLojas(filtros).filter((coluna) => coluna.hierarquia);
    return [
        ...hierarquia,
        { chave: "nome_loja", rotulo: "Loja", valor: (c) => c.nome_loja, classe: "texto-esquerda",
            html: (c) => `<strong>${c.nome_loja}</strong><small>${c.chave_loja}</small>` },
        ...COLUNAS_CONTRATOS,
    ];
}

export function reiniciarPaginaContratos() { pagina = 1; }

export function filtrarSituacaoContratos(linhas, situacao) {
    return situacao ? linhas.filter((c) => c.situacao === situacao) : linhas;
}

export function paginaContratos(linhas) {
    const paginas = Math.max(1, Math.ceil(linhas.length / TAMANHO_PAGINA));
    pagina = Math.min(pagina, paginas);
    const inicio = (pagina - 1) * TAMANHO_PAGINA;
    const contador = document.getElementById("contratos-contagem");
    if (contador) contador.textContent = linhas.length
        ? `${inteiro(inicio + 1)}–${inteiro(Math.min(inicio + TAMANHO_PAGINA, linhas.length))} de ${inteiro(linhas.length)} contratos · Página ${pagina}/${paginas}`
        : "Nenhum contrato encontrado";
    document.getElementById("contratos-anterior").disabled = pagina === 1;
    document.getElementById("contratos-proximo").disabled = pagina === paginas;
    return linhas.slice(inicio, inicio + TAMANHO_PAGINA);
}

export function barraContratos(filtros, aoSituacao, aoPagina, aoPeriodo) {
    reiniciarPaginaContratos();
    document.getElementById("detalhe-barra").innerHTML = `
        <div class="contratos-periodo">
            <label class="filtro-inline">De <input type="date" id="contratos-data-ini" required></label>
            <label class="filtro-inline">Até <input type="date" id="contratos-data-fim" required></label>
            <button type="button" class="btn-secundario" id="contratos-aplicar-periodo">Aplicar período</button>
        </div>
        <input type="search" id="detalhe-busca" class="campo-busca" placeholder="Buscar contrato, NSU, CPF ou loja..." aria-label="Buscar contratos">
        <label class="filtro-inline">Situação <select id="contratos-situacao">
            <option value="">Todas as situações</option>
            ${Object.entries(NOMES_SITUACAO).filter(([chave]) => chave !== "PENDENTE")
                .map(([chave, nome]) => `<option value="${chave}">${nome}</option>`).join("")}
        </select></label>
        <span class="dica" id="contratos-contagem" aria-live="polite"></span>
        <button type="button" class="btn-secundario" id="contratos-anterior">Anterior</button>
        <button type="button" class="btn-secundario" id="contratos-proximo">Próxima</button>
        <button type="button" class="btn-secundario" id="detalhe-exportar" title="Exporta todos os contratos encontrados, incluindo as outras páginas">Exportar Excel</button>`;
    const select = document.getElementById("contratos-situacao");
    select.value = filtros.situacao || "";
    const inicio = document.getElementById("contratos-data-ini");
    const fim = document.getElementById("contratos-data-fim");
    inicio.value = filtros.data_ini;
    fim.value = filtros.data_fim;
    const validar = () => {
        fim.setCustomValidity(inicio.value && fim.value && inicio.value > fim.value
            ? "A data Até deve ser igual ou posterior à data De." : "");
    };
    inicio.addEventListener("change", validar);
    fim.addEventListener("change", validar);
    document.getElementById("contratos-aplicar-periodo").addEventListener("click", () => {
        validar();
        if (inicio.reportValidity() && fim.reportValidity()) aoPeriodo({ data_ini: inicio.value, data_fim: fim.value });
    });
    select.addEventListener("change", () => { reiniciarPaginaContratos(); aoSituacao(select.value); });
    document.getElementById("contratos-anterior").addEventListener("click", () => { pagina--; aoPagina(); });
    document.getElementById("contratos-proximo").addEventListener("click", () => { pagina++; aoPagina(); });
}
