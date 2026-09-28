import { parametros } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";

export function exportarEquipe(botao) {
    return baixarXlsx("/api/exportar/equipe", parametros(), botao);
}
