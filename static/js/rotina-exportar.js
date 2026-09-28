import { parametros } from "./estado.js";
import { baixarXlsx } from "./exportar-xlsx.js";

export function exportarRotina({ botao, dataIni, metrica }) {
    return baixarXlsx("/api/exportar/rotina", {
        ...parametros(),
        data_ini: dataIni,
        metrica,
    }, botao);
}
