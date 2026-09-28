import { parametros } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";

export function exportarTabela(botao) {
    return baixarXlsx("/api/exportar/tabela", parametros(), botao);
}
