import { estado, parametrosDu } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";

export function exportarRankingDu(botao) {
    return baixarXlsx("/api/exportar/du", {
        ...parametrosDu(),
        metrica: estado.du.metrica,
    }, botao);
}
