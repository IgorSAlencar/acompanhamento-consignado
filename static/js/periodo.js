// Selo de periodo de referencia exibido nos cards e nos titulos das secoes
import { estado } from "./estado.js";
import { dataCurta } from "./formato.js";

export function textoPeriodo(inicio, fim) {
    return inicio === fim ? dataCurta(inicio) : `${dataCurta(inicio)} a ${dataCurta(fim)}`;
}

// alvo: valor do atributo data-periodo ("geral" acompanha o filtro do topo)
export function definirPeriodo(alvo, inicio, fim) {
    const texto = textoPeriodo(inicio, fim);
    document.querySelectorAll(`[data-periodo="${alvo}"]`).forEach((el) => {
        el.textContent = texto;
        el.title = `Período de referência: ${texto}`;
    });
}

export function atualizarPeriodoGeral() {
    definirPeriodo("geral", estado.dataIni, estado.dataFim);
}
