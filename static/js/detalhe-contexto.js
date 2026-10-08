import { NOMES_PRODUTO, NOMES_SITUACAO } from "./detalhe-colunas.js";
import { descricaoDe } from "./filtros.js";
import { dataCurta } from "./formato.js";

export function atualizarChips(contexto) {
    const f = contexto.filtros;
    const chips = [f.data_ini === f.data_fim ? dataCurta(f.data_ini) : `${dataCurta(f.data_ini)} a ${dataCurta(f.data_fim)}`];
    chips.push(f.produto ? NOMES_PRODUTO[f.produto] : "Todos os produtos");
    if (f.situacao) chips.push(NOMES_SITUACAO[f.situacao]);
    ["gerencia", "coordenacao", "supervisao"].forEach((nivel) => {
        if (f[nivel]) chips.push(descricaoDe(nivel, f[nivel]));
    });
    document.getElementById("detalhe-contexto").innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join("");
}

export function atualizarMigalhas(trilha, loja, aoIr, direto = false) {
    const alvo = document.getElementById("detalhe-migalhas");
    if (direto) { alvo.replaceChildren(); return; }
    const itens = [{ rotulo: "Resumo", acao: () => aoIr(0) }];
    trilha.forEach((passo, i) => itens.push({ rotulo: passo.valor, acao: () => aoIr(i + 1) }));
    if (loja) itens.push({ rotulo: loja.nome_loja });
    alvo.innerHTML = itens.map((item, i) => {
        const ultimo = i === itens.length - 1;
        return `<button type="button" class="migalha" data-passo="${i}" ${ultimo ? "disabled" : ""}>${item.rotulo}</button>`;
    }).join('<span class="migalha-separador">&gt;</span>');
    alvo.querySelectorAll("[data-passo]:not([disabled])").forEach((b) =>
        b.addEventListener("click", () => itens[Number(b.dataset.passo)].acao()));
}
