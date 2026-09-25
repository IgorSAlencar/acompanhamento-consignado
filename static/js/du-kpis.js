// Cards de ritmo da aba Dia Util (valores cheios, como nos KPIs gerais)
import { inteiro, moeda } from "./formato.js";

const FORMATOS = { vlr: moeda, qtd: inteiro, lojas: inteiro, tentativas: inteiro };
const NOMES = {
    vlr: "produção averbada",
    qtd: "operações averbadas",
    lojas: "lojas produtivas",
    tentativas: "tentativas",
};

const IDS = ["du-kpi-acum", "du-kpi-dia", "du-kpi-projecao", "du-kpi-lojas", "du-kpi-alerta"];

const definir = (id, texto) => { document.getElementById(id).textContent = texto; };
const umaCasa = (valor) => (valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function htmlProjecao(formatar, acum, du, totalDus, projecao) {
    const ritmoDia = du ? acum / du : 0;
    return `
        <strong>Como chegamos neste número</strong>
        <span>O ritmo médio por dia útil até agora, estendido até o fim do mês.</span>
        <span class="du-tooltip-conta">${formatar(acum)} &divide; ${inteiro(du)} &times; ${inteiro(totalDus)}</span>
        <span>acumulado até o DU ${du}, dividido pelos ${inteiro(du)} dias úteis já fechados e multiplicado pelos ${inteiro(totalDus)} dias úteis do mês.</span>
        <span>Dá ${formatar(ritmoDia)} por dia útil, ou ${formatar(projecao)} no fechamento.</span>`;
}

function textoDesvio(desvio) {
    if (desvio == null) return "sem base de comparação";
    return `${desvio > 0 ? "+" : ""}${umaCasa(desvio)}% vs média`;
}

export function cartoesDuCarregando() {
    IDS.forEach((id) => document.getElementById(id).classList.add("skeleton"));
}

// Cards 1-4: ritmo da metrica selecionada + lojas produtivas (sempre "ate o DU N")
export function atualizarCartoesDu(curva, metrica) {
    const ritmo = curva.ritmo[metrica];
    const formatar = FORMATOS[metrica];
    const du = curva.du_atual;
    const totalDus = Number(curva.total_dus[curva.mes_ref]) || 0;

    definir("du-kpi-acum-rotulo", `Acumulado até DU ${du} · ${NOMES[metrica]}`);
    definir("du-kpi-acum", formatar(ritmo.atual_acum));
    definir("du-kpi-acum-detalhe", `média dos meses anteriores: ${formatar(ritmo.media_acum)} · ${textoDesvio(ritmo.desvio_pct)}`);

    definir("du-kpi-dia-rotulo", `No DU ${du}`);
    definir("du-kpi-dia", formatar(ritmo.atual_du));
    definir("du-kpi-dia-detalhe", `média do DU ${du} nos meses anteriores: ${formatar(ritmo.media_du)}`);

    definir("du-kpi-projecao", formatar(ritmo.projecao));
    definir("du-kpi-projecao-detalhe", `ritmo até DU ${du} projetado para ${inteiro(totalDus)} DUs do mês`);
    document.getElementById("du-kpi-projecao-dica").innerHTML = htmlProjecao(
        formatar, ritmo.atual_acum, du, totalDus, ritmo.projecao,
    );

    const lojas = curva.ritmo.lojas;
    definir("du-kpi-lojas", inteiro(lojas.atual_acum));
    definir("du-kpi-lojas-detalhe", `média ${umaCasa(lojas.media_acum)} · ${textoDesvio(lojas.desvio_pct)}`);

    ["du-kpi-acum", "du-kpi-dia", "du-kpi-projecao", "du-kpi-lojas"].forEach((id) =>
        document.getElementById(id).classList.remove("skeleton"));
}

// Card 5: entidades fora do padrao (vem do ranking, muda com o nivel)
export function atualizarCartaoAlerta(ranking) {
    const { resumo } = ranking;
    definir("du-kpi-alerta-rotulo", `Fora do padrão · ${ranking.rotulo}`);
    definir("du-kpi-alerta", inteiro(resumo.zerado + resumo.abaixo));
    definir(
        "du-kpi-alerta-detalhe",
        `${inteiro(resumo.zerado)} zerados · ${inteiro(resumo.abaixo)} abaixo · `
        + `${inteiro(resumo.parados)} parados há ${ranking.dus_parado_alerta}+ DUs`,
    );
    document.getElementById("du-kpi-alerta").classList.remove("skeleton");
}
