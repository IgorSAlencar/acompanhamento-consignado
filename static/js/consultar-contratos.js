import { abrirDetalhe } from "./detalhe.js";
import { estado, parametros, parametrosDu } from "./estado.js";

export function iniciarConsultaContratos() {
    document.getElementById("consultar-contratos").addEventListener("click", () => {
        const filtros = estado.modo === "du"
            ? { ...parametrosDu(), modo: "du" }
            : parametros();
        abrirDetalhe({ titulo: "Contratos do período", filtros, visaoInicial: "contratos" });
    });
}
