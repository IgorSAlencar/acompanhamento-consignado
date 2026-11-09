// Acesso discreto a uma visao alternativa; cada abertura da pagina inicia no comercial.
import { estado, nivelDerivado, nivelDerivadoDu } from "./estado.js";
import { recarregarOpcoes } from "./filtros.js";

export function iniciarVisaoMacro(recarregar, aguardar) {
    const botao = document.getElementById("alternar-macro");
    let filtrosComerciais = null;
    const campos = ["gerencia", "coordenacao", "supervisao", "nivelEquipe"];

    botao.addEventListener("click", async () => {
        botao.disabled = true;
        try {
            await aguardar();
            const anterior = { ...estado, du: { ...estado.du } };
            const ativar = estado.escopo !== "macro";
            if (ativar) {
                filtrosComerciais = Object.fromEntries(campos.map((campo) => [campo, estado[campo]]));
                filtrosComerciais.nivelDu = estado.du.nivel;
                Object.assign(estado, { escopo: "macro", segmento: "", gerencia: "", coordenacao: "", supervisao: "" });
            } else {
                Object.assign(estado, { escopo: "comercial", segmento: "" }, filtrosComerciais || {});
            }
            estado.nivelEquipe = ativar ? nivelDerivado() : (filtrosComerciais?.nivelEquipe || "gerencia");
            estado.du.nivel = ativar ? nivelDerivadoDu() : (filtrosComerciais?.nivelDu || "gerencia");
            try {
                await recarregarOpcoes();
            } catch (erro) {
                Object.assign(estado, anterior);
                throw erro;
            }
            document.body.classList.toggle("modo-macro", ativar);
            botao.setAttribute("aria-pressed", String(ativar));
            botao.title = ativar ? "Voltar à visão comercial" : "Abrir visão macro";
            document.getElementById("macro-indicador").hidden = !ativar;
            document.dispatchEvent(new Event("visao:alterada"));
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
            await recarregar();
        } catch (erro) {
            document.getElementById("erro-mensagem").textContent = erro.message;
            document.getElementById("erro-global").classList.remove("oculto");
        } finally {
            botao.disabled = false;
        }
    });
}
